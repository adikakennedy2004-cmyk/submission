# Bright Future Scholarship

A Next.js App Router frontend for submitting scholarship applications to the
provided smart contract. Wallet access and contract transactions use ethers.js
v6 with an injected browser wallet such as MetaMask.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Contract and wallet setup

- The contract address and the `submitApplication` ABI are in
  `src/lib/contract.ts`.
- Connect a wallet that has the contract deployed on its currently selected
  network. The app checks that bytecode exists at the configured address before
  sending a transaction, and shows the connected chain ID.
- The contract accepts GPA as a `uint256`. The form accepts a GPA from 0.00 to
  4.00 and submits it multiplied by 100 (for example, 3.75 is submitted as
  `375`). Confirm that this matches the GPA convention used by your deployed
  contract.
- Application details are stored by the contract on a public blockchain.
  Applicants should not include sensitive information in their statement.
