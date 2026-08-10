<div align="center">

# ThankWall

**A self-hosted way to receive support/donations, with a public wall**

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

<br/>

<img src="1.jpg" width="80%" alt="ThankWall - Wall Page"/>

<br/><br/>

<img src="2.jpg" width="44%" alt="Join the Wall - Send Step"/>
&nbsp;&nbsp;
<img src="3.jpg" width="44%" alt="Join the Wall - Currency Step"/>

<br/><br/>

## Deploy in one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Foffici5l%2FThankWall&env=REOWN_PROJECT_ID,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN,ADDRESS_EVM,DESCRIPTION,MIN_ETH,MIN_BNB,MIN_USDT)

New to this? [SETUP.md](SETUP.md) walks through getting each variable, step by step.

---

</div>

**Environment Variables**

| Variable | Required |
|----------|----------|
| `REOWN_PROJECT_ID` | Yes |
| `UPSTASH_REDIS_REST_URL` | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Yes |
| `ADDRESS_EVM` | Yes |
| `DESCRIPTION` | No |
| `MIN_ETH` | No |
| `MIN_BNB` | No |
| `MIN_USDT` | No |

---

**How to get each variable**

- **`REOWN_PROJECT_ID`** — Create a project at [dashboard.reown.com](https://dashboard.reown.com) and copy the Project ID
- **`UPSTASH_REDIS_REST_URL`** — Create a free Redis database at [console.upstash.com](https://console.upstash.com)
- **`UPSTASH_REDIS_REST_TOKEN`** — Found in the same Upstash database dashboard
- **`ADDRESS_EVM`** — Your EVM-compatible wallet address (`0x…`) — all supported currencies send to this address
- **`DESCRIPTION`** — A short text that appears at the top of your wall
- **`MIN_ETH`** — Minimum ETH amount enforced before a supporter can send
- **`MIN_BNB`** — Minimum BNB amount enforced before a supporter can send
- **`MIN_USDT`** — Minimum USDT amount enforced before a supporter can send

___

**Supported currencies**

| Currency       | Network              |
|----------------|----------------------|
| ETH            | Ethereum Mainnet     |
| BNB            | BNB Smart Chain      |
| USDT (BEP-20)  | BNB Smart Chain      |
| USDT (ERC-20)  | Ethereum Mainnet     |