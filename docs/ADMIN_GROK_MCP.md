# Grok admin MCP

The top administrator can connect Grok to a read-only MCP server on this site. The server URL is `https://<this-site>/api/mcp`. Other accounts cannot approve the connection, and the tools cannot create or change records.

Grok can:

- pull feedback that looks like a complaint or needs follow-up, for one day or a range, from selected branches
- list birthday clients for today or any date range
- look up a client by phone number or name
- list who checked in and when, including people still checked in, for up to 92 days
- list which callers filed reports and the details recorded in those reports, including feedback
- count the clients stored in the system

Dates are calendar dates in Africa/Kampala (`YYYY-MM-DD`).

## Connect on grok.com

1. Open **Admin → Grok MCP** while signed in as the top administrator and copy the server URL.
2. Go to [grok.com/connectors](https://grok.com/connectors), choose **New Connector**, then **Custom**, and paste that URL.
3. Sign in with the top administrator Google account when Grok asks. The approval page refuses every other account.
4. Ask Grok a question that needs SpaGym, such as who has a birthday today or which feedback from a branch needs attention.

Grok must be able to reach the site over public HTTPS.

## Connect with a bearer key

On **Admin → Grok MCP**, create a connection key. The full key is shown once. Use it as the bearer token for the xAI API `authorization` field, or with the Grok command line:

```bash
grok mcp add --transport http spagym https://<this-site>/api/mcp --header "Authorization: Bearer <connection key>"
```

Replacing the key disconnects clients that used the old key. A grok.com sign-in connection keeps its own access token.

The key hash is stored in the `adminMcp` collection. Browser clients cannot read that collection.
