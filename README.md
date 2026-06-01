# NIC Medical Network

Unofficial public browser for the medical-network data exposed by the National Insurance Company Palestine website.

This project is not affiliated with NIC or NatHealth. It only reshapes publicly reachable provider data into a faster mobile-friendly directory.

## Local use

```bash
npm run sync
npm run serve
```

Then open `http://localhost:4173`.

## GitHub Pages

For a public repository named `nic-medical-network`, publish GitHub Pages from:

- Branch: `main`
- Folder: `/docs`

The site will be available at:

```text
https://ahmedasmar.github.io/nic-medical-network/
```

If using the GitHub CLI, re-authenticate first because the local token may be expired:

```bash
gh auth login -h github.com
gh repo create ahmedasmar/nic-medical-network --public --source=. --remote=origin --push
```

If using the GitHub MCP server from Codex, set a token in the environment before starting Codex:

```bash
export GITHUB_PAT_TOKEN=your_token_here
```

## Refresh data

Run:

```bash
npm run sync
```

The workflow in `.github/workflows/sync-data.yml` can also refresh the JSON file on a schedule and commit changes back to the repository.
