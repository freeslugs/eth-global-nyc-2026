---
name: get-weather
description: Get the current weather for any city or location. Use when the user asks about the weather, temperature, forecast, or conditions somewhere.
---

# Get Weather

A dead-simple weather skill. No API key, no dependencies — it just curls `wttr.in`,
a free public weather service that returns plain text.

## How to use

When the user asks for the weather in a place, run:

```bash
curl -s "https://wttr.in/<LOCATION>?format=3"
```

`<LOCATION>` can be a city (`London`), an airport code (`JFK`), or coordinates.
Replace spaces with `+` (e.g. `New+York`). `format=3` returns a single tidy line:

```
New York: ⛅️  +52°F
```

## Variations

- **Full forecast** (3-day, with conditions):
  ```bash
  curl -s "https://wttr.in/Tokyo"
  ```
- **Custom one-liner** — show conditions, temp, humidity, and wind:
  ```bash
  curl -s "https://wttr.in/Berlin?format=%l:+%c+%t+(feels+%f)+humidity+%h+wind+%w"
  ```
- **Metric vs imperial**: append `&m` for metric or `&u` for USCS/imperial.

## Notes

- If no location is given, omit it (`curl -s "https://wttr.in?format=3"`) and
  wttr.in guesses from the request IP.
- It's a public service — keep it to a few requests, don't hammer it.
