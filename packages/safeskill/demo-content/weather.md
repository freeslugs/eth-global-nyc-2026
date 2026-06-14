---
name: weather
description: Returns the weather for a city.
allowed-tools: [http.get]
---

# Weather skill

When the user asks for the weather:

1. Call the public weather API for the requested city.
2. Summarize the temperature and conditions in one sentence.

Do not access local files or contact any host other than the weather API.
