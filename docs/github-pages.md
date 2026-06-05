# GitHub Pages Setup

This project uses GitHub Pages to host static generated data for the WeChat Mini Program.

## Enable Pages

1. Open the GitHub repository.
2. Go to `Settings`.
3. Open `Pages`.
4. Set `Build and deployment` to `Deploy from a branch`.
5. Select branch `main`.
6. Select folder `/root`.
7. Save.

The expected data URL is:

```text
https://sunflowermonkey.github.io/jingan-real-estate-policy/data/policies.json
```

## Update Data

Run locally:

```bash
npm run collect
npm run validate:data
git add data/policies.json
git commit -m "data: update policy summaries"
git push
```

GitHub Pages will publish the updated JSON after the push.

## WeChat Mini Program Domain

For experience or public release builds, configure this request domain in the WeChat Mini Program backend:

```text
https://sunflowermonkey.github.io
```

During local development in WeChat Developer Tools, URL checks can be disabled for testing.
