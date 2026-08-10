# Setup

Running your own ThankWall takes three accounts (Vercel, Reown, Upstash) and one wallet address. All three accounts have a free tier that's enough for this project.

## 1. Get a Reown Project ID

1. Go to [dashboard.reown.com](https://dashboard.reown.com) and sign in (or create an account).
2. Create a new project, product type **AppKit**.
3. Copy the **Project ID** from the project dashboard. This becomes `REOWN_PROJECT_ID`.

## 2. Create an Upstash Redis database

1. Go to [console.upstash.com](https://console.upstash.com) and sign in.
2. Create a database on the **Free** tier — no card required.
3. Open the database, find the **REST API** section, and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

If you're deploying on Vercel, you can skip this step and instead add the **Upstash** integration from the Vercel Marketplace after step 3 below — it provisions the database and fills in both variables for you.

## 3. Deploy to Vercel

1. Click the **Deploy with Vercel** button in the README, or import this repo manually at [vercel.com/new](https://vercel.com/new).
2. When prompted for environment variables, fill in:

   | Variable | Value |
   |----------|-------|
   | `REOWN_PROJECT_ID` | from step 1 |
   | `UPSTASH_REDIS_REST_URL` | from step 2 |
   | `UPSTASH_REDIS_REST_TOKEN` | from step 2 |
   | `ADDRESS_EVM` | your own `0x…` address — this is where all donations arrive |

3. Deploy. The optional variables (`DESCRIPTION`, `MIN_ETH`, `MIN_BNB`, `MIN_USDT`) can be added any time from **Project → Settings → Environment Variables**, followed by a redeploy.

## 4. Verify it

1. Open your deployed URL and connect a wallet that holds a little ETH or BNB.
2. Send a small amount to yourself through the **Join the Wall** flow.
3. Sign the confirmation message when prompted — this is a second, separate wallet prompt after the transaction, and it's what proves the entry is really coming from the wallet that paid.
4. Once the transaction confirms on-chain, the entry appears on the wall automatically.

## Troubleshooting

| Message | Meaning |
|---------|---------|
| `Wallet not configured` | `ADDRESS_EVM` isn't set, or the deployment wasn't redeployed after adding it |
| `Transaction recipient does not match the expected address` | The transaction went to a different address or chain than the one selected |
| `Transaction is pending confirmation. Retrying…` | Normal — the app is waiting for the transaction to be mined |
| `Signature does not match the wallet that sent this transaction` | The message was signed with a different wallet/account than the one that sent the funds |
| `Transaction already submitted` | This transaction hash is already recorded on the wall |
