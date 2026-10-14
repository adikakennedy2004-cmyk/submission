"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ChangeEvent } from "react";
import { BrowserProvider, Contract, isAddress, type Eip1193Provider } from "ethers";
import { CONTRACT_ADDRESS, SCHOLARSHIP_ABI } from "@/lib/contract";

type WalletProvider = Eip1193Provider & {
  on: (event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void) => void;
  removeListener: (
    event: "accountsChanged" | "chainChanged",
    listener: (value: unknown) => void,
  ) => void;
};
type TransactionState = "idle" | "connecting" | "submitting" | "success" | "error";

declare global {
  interface Window {
    ethereum?: WalletProvider & {
      on: (
        event: "accountsChanged" | "chainChanged",
        listener: (value: string[] | string) => void,
      ) => void;
      removeListener: (
        event: "accountsChanged" | "chainChanged",
        listener: (value: string[] | string) => void,
      ) => void;
    };
  }
}

const initialForm = {
  fullName: "",
  email: "",
  university: "",
  courseOfStudy: "",
  yearOfStudy: "",
  gpa: "",
  statement: "",
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if ("code" in error && error.code === "ACTION_REJECTED") {
      return "The request was rejected in your wallet. You can try again whenever you’re ready.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [transactionState, setTransactionState] = useState<TransactionState>("idle");
  const [feedback, setFeedback] = useState("");
  const [transactionHash, setTransactionHash] = useState("");

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setTransactionState("error");
      setFeedback("No wallet found. Install MetaMask or another browser wallet to continue.");
      return;
    }

    setTransactionState("connecting");
    setFeedback("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
      if (!accounts[0]) {
        throw new Error("No wallet account was returned. Unlock your wallet and try again.");
      }

      const network = await provider.getNetwork();
      setWalletAddress(accounts[0]);
      setChainId(network.chainId.toString());
      setTransactionState("idle");
    } catch (error) {
      setTransactionState("error");
      setFeedback(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccount = Array.isArray(accounts) ? accounts[0] : "";
      setWalletAddress(nextAccount ?? "");
      if (!nextAccount) setChainId("");
      setTransactionState("idle");
      setFeedback("");
    };

    const handleChainChanged = (nextChainId: unknown) => {
      if (typeof nextChainId === "string") {
        setChainId(BigInt(nextChainId).toString());
      }
      setTransactionState("idle");
      setFeedback("");
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (transactionState === "error" || transactionState === "success") {
      setTransactionState("idle");
      setFeedback("");
      setTransactionHash("");
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletAddress) {
      setTransactionState("error");
      setFeedback("Connect your wallet before submitting your application.");
      return;
    }

    if (!isAddress(CONTRACT_ADDRESS)) {
      setTransactionState("error");
      setFeedback("The scholarship contract address is invalid.");
      return;
    }

    const gpa = Number(form.gpa);
    if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4) {
      setTransactionState("error");
      setFeedback("Enter a GPA between 0.00 and 4.00.");
      return;
    }

    setTransactionState("submitting");
    setFeedback("Confirm the transaction in your wallet to send your application.");
    setTransactionHash("");

    try {
      if (!window.ethereum) {
        throw new Error("Your wallet disconnected. Reconnect it and try again.");
      }

      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (chainId && network.chainId.toString() !== chainId) {
        throw new Error("Your wallet network changed. Please reconnect your wallet and try again.");
      }

      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === "0x") {
        throw new Error(
          `No scholarship contract was found at ${CONTRACT_ADDRESS} on the connected network (chain ${network.chainId}). Switch to the network where the contract is deployed.`,
        );
      }

      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, SCHOLARSHIP_ABI, signer);
      const transaction = await contract.submitApplication(
        form.fullName.trim(),
        form.email.trim(),
        form.university.trim(),
        form.courseOfStudy.trim(),
        BigInt(form.yearOfStudy),
        BigInt(Math.round(gpa * 100)),
        form.statement.trim(),
      );

      setTransactionHash(transaction.hash);
      setFeedback("Your transaction was submitted and is waiting for confirmation.");
      await transaction.wait();
      setTransactionState("success");
      setFeedback("Your scholarship application has been submitted successfully.");
      setForm(initialForm);
    } catch (error) {
      setTransactionState("error");
      setFeedback(getErrorMessage(error));
    }
  }

  const isBusy = transactionState === "connecting" || transactionState === "submitting";

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Bright Future home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 3.5 28 10v12L16 28.5 4 22V10L16 3.5Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M11 20.5V12l10 8.5V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>bright<span className="brand-light">future</span></span>
        </a>
        <nav className="topbar-nav" aria-label="Main navigation">
          <a href="#about">About the grant</a>
          <a href="#application">Application</a>
        </nav>
        <button
          className={`wallet-button${walletAddress ? " wallet-button-connected" : ""}`}
          onClick={connectWallet}
          disabled={isBusy}
          type="button"
        >
          <span className="wallet-indicator" />
          {transactionState === "connecting"
            ? "Connecting…"
            : walletAddress
              ? shortAddress(walletAddress)
              : "Connect wallet"}
        </button>
      </header>

      <section className="hero" id="about">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Scholarship applications open</div>
          <h1>Your ambition<br />deserves a <em>bright</em><br />future.</h1>
          <p>
            We back the next generation of changemakers. Tell us where you’re
            headed — we’ll help you get there.
          </p>
          <a className="text-link" href="#application">
            Start your application <span aria-hidden="true">↘</span>
          </a>
        </div>

        <div className="hero-art" aria-label="Illustration of a student reaching for a star">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="star star-one">✳</div>
          <div className="star star-two">✦</div>
          <div className="sun-disc" />
          <div className="art-caption"><span>01</span> The next chapter starts here</div>
          <svg className="student-illustration" viewBox="0 0 400 340" fill="none" role="img" aria-label="Abstract illustration of a student">
            <path d="M104 320c13-63 43-93 92-93s79 30 94 93H104Z" fill="#1C4036" />
            <path d="m155 236 41 40 42-40-20-26h-44l-19 26Z" fill="#E8A88A" />
            <path d="M161 150c0-43 18-69 44-69 28 0 47 27 47 69v37c0 34-21 58-47 58-25 0-44-24-44-58v-37Z" fill="#A86F52" />
            <path d="M159 153c-9-40 7-77 43-86 31-8 62 11 67 48l-18-11-13-18c-12 20-39 30-78 30l-1 37Z" fill="#242A24" />
            <path d="M173 166h17m31 0h17" stroke="#242A24" strokeWidth="4" strokeLinecap="round" />
            <path d="M188 202c8 6 17 6 25 0" stroke="#F8D4B7" strokeWidth="3" strokeLinecap="round" />
            <path d="m158 238 38 38-34 18-35-39 31-17Zm86 0-50 38 34 18 42-39-26-17Z" fill="#F4EFE2" />
            <path d="M198 276v44m-37-83-52-53" stroke="#1C4036" strokeWidth="15" strokeLinecap="round" />
            <path d="m105 185-17-17" stroke="#A86F52" strokeWidth="13" strokeLinecap="round" />
            <path d="m245 238 47-77" stroke="#1C4036" strokeWidth="15" strokeLinecap="round" />
            <path d="m292 161 15-43" stroke="#A86F52" strokeWidth="13" strokeLinecap="round" />
            <path d="m307 116 4-14 5 12 13 1-11 7 2 13-9-9-11 6 5-12-8-10 10 6Z" fill="#E4BE55" />
            <path d="M60 320h280" stroke="#B9B29F" strokeWidth="1" />
            <circle cx="109" cy="121" r="3" fill="#1C4036" />
            <circle cx="316" cy="224" r="4" fill="#E4BE55" />
          </svg>
          <div className="art-side-note">LEARN<br />GROW<br />LEAD</div>
        </div>
      </section>

      <section className="details-strip" aria-label="Scholarship details">
        <div><span className="strip-label">WHO IT’S FOR</span><strong>Undergraduate students</strong></div>
        <div><span className="strip-label">APPLICATION TIME</span><strong>About 5 minutes</strong></div>
        <div><span className="strip-label">SUBMISSION</span><strong><span className="onchain-dot" /> Secured onchain</strong></div>
        <span className="strip-number">BF / 026</span>
      </section>

      <section className="application-section" id="application">
        <div className="section-heading">
          <div>
            <div className="eyebrow section-eyebrow"><span /> YOUR OPPORTUNITY</div>
            <h2>Make your case.</h2>
          </div>
          <p>There’s no perfect answer. Just tell us what matters to you, and where you want to go.</p>
        </div>

        <div className="application-grid">
          <form className="application-form" onSubmit={submitApplication}>
            <div className="form-topline">
              <span>APPLICATION FORM</span>
              <span><i /> STEP 01 <b>/</b> 01</span>
            </div>

            <div className="form-fields">
              <label className="field">
                <span>Full name <b>*</b></span>
                <input autoComplete="name" name="fullName" onChange={updateField} placeholder="e.g. Amara Okafor" required value={form.fullName} />
              </label>
              <label className="field">
                <span>Email address <b>*</b></span>
                <input autoComplete="email" name="email" onChange={updateField} placeholder="you@example.com" required type="email" value={form.email} />
              </label>
              <label className="field">
                <span>University <b>*</b></span>
                <input autoComplete="organization" name="university" onChange={updateField} placeholder="Your university name" required value={form.university} />
              </label>
              <label className="field">
                <span>Course of study <b>*</b></span>
                <input name="courseOfStudy" onChange={updateField} placeholder="e.g. Computer Science" required value={form.courseOfStudy} />
              </label>
              <label className="field">
                <span>Year of study <b>*</b></span>
                <select name="yearOfStudy" onChange={updateField} required value={form.yearOfStudy}>
                  <option disabled value="">Select your year</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((year) => (
                    <option key={year} value={year}>Year {year}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Current GPA <b>*</b></span>
                <div className="gpa-input">
                  <input max="4" min="0" name="gpa" onChange={updateField} placeholder="0.00" required step="0.01" type="number" value={form.gpa} />
                  <span>/ 4.00</span>
                </div>
              </label>
              <label className="field field-wide">
                <span>Your statement <b>*</b></span>
                <textarea
                  maxLength={1200}
                  minLength={30}
                  name="statement"
                  onChange={updateField}
                  placeholder="Tell us what you’re working toward, what drives you, and how this scholarship would make a difference…"
                  required
                  rows={5}
                  value={form.statement}
                />
                <span className="character-count">{form.statement.length} / 1,200</span>
              </label>
            </div>

            {feedback && (
              <div className={`feedback feedback-${transactionState}`} role="status" aria-live="polite">
                <span className="feedback-icon" aria-hidden="true">
                  {transactionState === "success" ? "✓" : transactionState === "error" ? "!" : "·"}
                </span>
                <span>{feedback}</span>
              </div>
            )}
            {transactionHash && (
              <div className="transaction-hash">
                Transaction <code>{transactionHash}</code>
              </div>
            )}

            {!walletAddress && (
              <p className="wallet-prompt">Connect your wallet to send your application onchain.</p>
            )}
            <button className="submit-button" disabled={isBusy || transactionState === "success"} type="submit">
              {transactionState === "submitting"
                ? "Waiting for confirmation…"
                : transactionState === "success"
                  ? "Application submitted"
                  : "Submit application"}
              {transactionState !== "submitting" && transactionState !== "success" && <span aria-hidden="true">↗</span>}
            </button>
            <p className="privacy-note">
              By submitting, your application details will be written to a public blockchain. Please don’t include sensitive information.
            </p>
          </form>

          <aside className="application-aside">
            <div className="aside-card">
              <span className="aside-label">A NOTE FROM US</span>
              <span className="quote-mark" aria-hidden="true">“</span>
              <blockquote>
                We’re not just investing in your education. We’re investing in the person you’re becoming.
              </blockquote>
              <div className="aside-rule" />
              <div className="signature">
                <span className="signature-mark">bf.</span>
                <span><strong>The Bright Future team</strong><small>Here for what comes next.</small></span>
              </div>
            </div>
            <div className="aside-footnote">
              <span className="footnote-number">01</span>
              <p>Your application is sent directly from your wallet. Once confirmed, it’s recorded permanently onchain.</p>
            </div>
            <div className="contract-note">
              <span className="onchain-dot" />
              <span>CONTRACT ADDRESS</span>
              <code>{shortAddress(CONTRACT_ADDRESS)}</code>
              {chainId && <small>Chain {chainId}</small>}
            </div>
          </aside>
        </div>
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="#" aria-label="Bright Future home">
          <span className="brand-mark" aria-hidden="true">bf.</span>
          <span>bright<span className="brand-light">future</span></span>
        </a>
        <span>Make room for what’s next.</span>
        <span>© 2026 Bright Future Scholarship</span>
      </footer>
    </main>
  );
}
