# aegis-review — CRE CLI runbook

Run all commands from the `apps/cre-workflow/` directory.

## Simulate (local, no deployment)

```sh
# Listen for live TextChanged events on Sepolia
cre workflow simulate aegis-review --listen

# Replay a known transaction (fastest for iteration)
cre workflow simulate aegis-review \
  --evm-tx-hash 0x7076db66f55898c6aa6a4c22979d090e652b3f29615337ff7d04f6535fc344b9 \
  --evm-event-index 0

# Same, with no resource limits (needed to get through the full AI polling loop)
cre workflow simulate aegis-review \
  --evm-tx-hash 0x7076db66f55898c6aa6a4c22979d090e652b3f29615337ff7d04f6535fc344b9 \
  --evm-event-index 0 \
  --limits none
```

The simulation logs inference IDs like:
```
[USER LOG] Inference submitted id=019ec525-f534-72d4-920b-be2c19af2ae3
```

Save those — if the workflow times out before the status endpoint catches up (~90s lag),
you can fetch the result manually:

```sh
node --env-file=.env packages/adapters/scripts/ai-tee-result.ts <inference-id>
node --env-file=.env packages/adapters/scripts/ai-tee-result.ts <inference-id> --poll
```

Then write it to ENS manually:

```sh
node --env-file=.env packages/adapters/scripts/attest.ts \
  geo-audit.acme.safeskills.eth pass 100 chainlink.eth
```

## Server-side path (no CRE deployment needed)

Runs the full flow — ENS lookup → fetch SKILL.md → Confidential AI → ENS write.
Use this while CRE deploy access is pending, or to trigger attestations from the server.

```sh
# From repo root
node --env-file=.env packages/adapters/scripts/ai-tee-attest.ts \
  geo-audit.acme.safeskills.eth
```

Needs `.env`: `AEGIS_PRIVATE_KEY`, `AEGIS_RPC_URL`, `AEGIS_ENS_RESOLVER`, `CONFIDENTIAL_AI_API_KEY`.

## Secrets

```sh
# Push local .env secrets to the Vault DON (required before deploying)
cre secrets create aegis-review --target staging-settings

# List secrets currently stored
cre secrets list
```

## Deploy

```sh
# Deploy to the private registry (staging)
cre workflow deploy aegis-review --target staging-settings

# Check deployment status
cre workflow list

# View execution logs for a deployed workflow
cre workflow logs aegis-review
```

## Misc

```sh
# List chains the CLI knows about
cre workflow supported-chains

# Validate workflow config without running
cre workflow validate aegis-review
```

## Known good tx for testing

| tx | event index | what it does |
|----|-------------|--------------|
| `0x7076db66f55898c6aa6a4c22979d090e652b3f29615337ff7d04f6535fc344b9` | 0 | Sets `safeskills.pin` on `geo-audit` — triggers full flow, AI returns `pass / riskScore=0` |
