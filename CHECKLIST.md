# ChatBridge Project Checklist

> Derived from the [G4 Week 7 assignment PDF](../G4%20Week%207%20-%20ChatBridge%20(6).pdf). Statuses reflect current repo state.

---

## MVP + Pre-search Requirements (24 Hours) — Hard Gate

- [x] Pre-search document
- [x] 500-word "Case Study Analysis" (key problems, trade-offs, ethical decisions)
- [ ] **3-5 minute technical architecture video**
- [x] Push forked repo to GitLab

## Chat Features

| Feature | Requirement | Status |
|---|---|---|
| Messaging | Real-time AI chat with streaming responses | [x] |
| History | Persistent conversation history across sessions | [x] |
| Context | Chat maintains context about active third-party apps and their state | [x] |
| Multi-turn | Complex multi-turn conversations spanning app interactions | [x] |
| Error Recovery | Graceful handling when apps fail, timeout, or return errors | [x] |
| User Auth | User authentication for the chat platform | [x] |

## Third-Party App Integration Architecture

- [x] Apps can register themselves and their capabilities with the platform
- [x] Apps define tool schemas the chatbot can discover and invoke
- [x] Apps render their own UI within the chat experience (sandboxed iframe)
- [x] Apps receive tool invocations from the chatbot with structured parameters
- [x] Apps signal completion back to the chatbot when their task is done
- [x] Apps maintain their own state independently from the chat

## Required Apps (3 minimum, Chess required)

### Chess (Required)
- [x] High complexity — ongoing state, bidirectional communication
- [x] Interactive chess board with legal move validation
- [x] Tools: start game, move pieces, ask for help mid-game, error on invalid moves
- [x] Full lifecycle: "let's play chess" → board appears → mid-game help → game ends → chatbot discusses

### Weather Dashboard
- [x] External API, no user auth, UI rendering
- [x] `weather__get_weather` tool with location parameter
- [x] Result display + auto-completion

### Spotify Playlist Creator (OAuth)
- [x] OAuth authentication flow, external API
- [x] Tools: `spotify__get_auth_status`, `spotify__create_playlist`
- [x] OAuth2 proxy (authorize/callback/status endpoints)
- [x] Token storage, CSRF nonce protection
- [ ] **Real Spotify token exchange** (currently mocked)
- [ ] **Token auto-refresh against real Spotify API**

## Authentication & App Types

| App Type | Auth Pattern | Status |
|---|---|---|
| Internal | No auth needed — bundled with platform | [x] Chess |
| External (Public) | API key or none — no user-specific auth | [x] Weather |
| External (Authenticated) | OAuth2 — user must authorize | [x] Spotify (mocked tokens) |

- [x] Platform handles OAuth flow
- [x] Store tokens securely
- [ ] **Refresh tokens automatically** (logic exists, not wired to real API)
- [x] Pass credentials to app when invoking tools

## Testing Scenarios (Grader will test these)

1. [x] User asks chatbot to use a third-party app (tool discovery and invocation)
2. [x] Third-party app UI renders correctly within the chat
3. [x] User interacts with app UI, then returns to chatbot (completion signaling)
4. [x] User asks chatbot about app's results after completion (context retention)
5. [x] User switches between multiple apps in the same conversation
6. [x] User asks ambiguous question that could map to multiple apps (routing accuracy)
7. [x] Chatbot correctly refuses to invoke apps for unrelated queries

## AI Cost Analysis

- [ ] **Track actual dev spend** (LLM API costs — OpenAI, Anthropic, etc.)
- [ ] **Total tokens consumed** (input/output breakdown)
- [ ] **Number of API calls made**
- [ ] **Production cost projections** for 100 / 1K / 10K / 100K users
- [ ] **Assumptions documented** (avg tool invocations per session, tokens per invocation, etc.)

## Submission Deliverables

| Deliverable | Requirement | Status |
|---|---|---|
| GitLab Repository | Setup guide, architecture overview, API docs, deployed link | [x] |
| Demo Video (3-5 min) | Chat + app integration demo, plugin lifecycle, architecture explanation | [ ] |
| AI Cost Analysis | Dev spend + projections for 100/1K/10K/100K users | [ ] |
| Deployed Application | Publicly accessible, 3+ working third-party apps | [x] |
| Social Post (final only) | X or LinkedIn, description + features + demo, tag @GauntletAI | [ ] |

## Build Strategy Priority Order

1. [x] Basic chat — AI chatbot with conversation history end-to-end
2. [x] App registration — tool spec contract, registration API
3. [x] Tool invocation — chatbot discovers and calls a single app's tools
4. [x] UI embedding — app renders its UI within the chat interface
5. [x] Completion signaling — app tells chatbot when it's done, chatbot resumes
6. [x] Context retention — chatbot remembers app results in subsequent turns
7. [x] Multiple apps — register and route between 3+ apps
8. [x] Auth flows — handle apps requiring user authentication
9. [x] Error handling — timeouts, crashes, invalid tool calls
10. [x] Developer docs — API documentation for third-party developers

---

## Summary

**Done:** Core platform, all 3 apps, all 7 testing scenarios, deployment, docs

**Remaining (T21 deliverables):**
- [ ] 3-5 min demo video
- [ ] AI cost analysis (dev spend + projections)
- [ ] Social media post (tag @GauntletAI)
- [ ] Real Spotify token exchange (nice-to-have, mock works for demo)
