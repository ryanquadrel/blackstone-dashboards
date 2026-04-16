# AI Portfolio Dashboard — Build Specification

**For:** Claude Code session in the Blackstone dashboards GitHub repo
**Author:** Ryan Quadrel
**Date:** April 16, 2026
**Companion:** `ai-portfolio-data.json` (data model), `Blackstone-AI-Committee-Coordination-Framework.md` (Option A rationale), `Blackstone-AI-Portfolio-Inventory.md` (narrative inventory)

---

## Context

The Blackstone AI Committee needs a visual companion to the AI Portfolio Inventory memo. The committee has ~50 systems catalogued across 8 functional categories with cross-system dependencies, overlaps, capability gaps, and a convergence story with Omri's Blackstone AI platform. A text memo cannot surface the relational structure effectively — this dashboard can.

This build also serves as the first concrete artifact of the coordination framework's recommended "Option A — Dashboard-Native" source of truth. It should feel like a first-class citizen of the existing Blackstone dashboard stack, not an external one-off.

## Inputs

**Data source:** `ai-portfolio-data.json`

The JSON file contains:

- `meta` — generation info
- `categories`, `lifecycle_stages`, `owners`, `statuses`, `integration_types` — enumerations
- `systems` — the main array; each entry has: `id`, `name`, `owners` (array), `status`, `integration`, `category`, `lifecycle_stage`, `description`, `includes` (array), `connects_to` (array of system IDs), `is_hypothetical` (boolean), optional `flags` (array)
- `overlaps`, `gaps`, `architectural_seams` — cross-cutting observations for the overlaps/gaps panel

Load the JSON at page load. The dashboard renders entirely client-side; no backend.

## Output

**Single deployable HTML file** named `ai-portfolio.html` (or `index.html` within an `ai-portfolio/` directory — match the pattern of the other dashboards in this repo).

Route: something like `/ai-portfolio/` following the pattern of `/motion-dashboard`, `/mediation-pipeline`, `/discovery-tracker`, `/competing-cases`.

Deploy target: the same Railway + GitHub auto-deploy pipeline as the other dashboards.

## Five Visualizations

Order them top-to-bottom on the page. Each should be visually distinct but share a common style language with the other Blackstone dashboards.

### 1. Case Lifecycle Pipeline

**Purpose:** show how a matter moves through firm systems from intake to settlement.

**Format:** horizontal flow diagram, SVG or CSS-based.

**Stages (left to right):** Intake → Onboarding → Discovery → Motion Practice → Mediation → Settlement. Plus a floating "Cross-Cutting" band below for systems that apply across stages (Operations, Memory, Drafts Registry, etc.).

**Rendering:** for each stage, render the systems whose `lifecycle_stage` matches. Color-code by owner. Size nodes uniformly or by connection count. Arrows/lines between stages show the forward flow.

**Interactivity:** hover on a node shows system name, owner, status, and short description in a tooltip. Click opens the full detail card (see below).

**Purpose served:** this is the "what happens when a case comes in" narrative made visual. It replaces most of Section 3 (Integration Narrative) in the text memo.

### 2. System Connection Network

**Purpose:** show cross-system dependencies at a glance; surface architecturally central systems.

**Format:** interactive force-directed graph using D3.js (CDN).

**Rendering:** each system is a node. Each `connects_to` entry is an edge. Node color = owner. Node size = total degree (in + out connections) — this makes Memory System, Case Command Center Stack, and Drafts Registry visually prominent because they connect to many systems. Edge color can hint at direction (in/out) or stay neutral.

**Filters:** dropdown or toggle buttons for: (a) category, (b) owner, (c) status, (d) hypothetical on/off. Filtering hides non-matching nodes and their edges.

**Interactivity:** hover highlights the node's connections. Click opens the detail card.

**Legend:** owner-color legend. Badge showing "hypothetical" for dashed-border hypothetical nodes.

### 3. Category × Ownership Heatmap

**Purpose:** restore proportional ownership visually; show where each builder concentrates.

**Format:** CSS grid or simple HTML table styled as a heatmap.

**Rendering:** rows = functional categories (8); columns = owners (Ryan, Saim, Omri, JD, Doron, Brett, Jonathan, Firm). Cell value = count of systems where that owner is listed as an owner in that category. Color intensity scales with count (deeper color for higher counts).

**Formatting:** include marginal totals (row totals on the right, column totals at the bottom). Display numbers inside cells.

**Purpose served:** a reader seeing "Ryan: 24 systems" in the appendix sees it differently when they can also see that those 24 are spread across 8 categories, each building on the others. Makes the ownership distribution legible at a glance.

### 4. Convergence Status Map

**Purpose:** visualize the Blackstone AI platform convergence story.

**Format:** grouped bar chart or stacked category view. Simple — doesn't need to be interactive.

**Rendering:** one bar per functional category. Within each bar, segments colored by integration status: Native (firm stack), Bridge, Standalone, Platform, Infrastructure, TBD. Shows at a glance which categories are well-integrated vs. which have dangling Standalone or TBD systems.

**Alternative:** a simple 2D matrix with Integration type on one axis and Category on the other, with counts in cells — similar to the ownership heatmap.

**Purpose served:** shows Jeremy and the committee, in one panel, where the portfolio stands relative to Omri's platform.

### 5. Overlaps, Gaps, and Seams Panel

**Purpose:** surface the committee-action items that the cross-cutting observations section covers.

**Format:** three columns of cards (responsive — stack on narrow viewports).

**Columns:**

- **Overlaps Worth Reconciling** — one card per entry in `overlaps` array. Card shows title, description, involved systems (clickable), optional resolution system.
- **Capability Gaps** — one card per entry in `gaps` array. Card shows title, description, candidate solutions, and priority flag if present (emphasize `gap-priority-1`).
- **Architectural Integration Seams** — one card per entry in `architectural_seams` array. Card shows title and description.

**Interactivity:** clicking any system name in a card highlights that node in the Network Graph above (scroll to network + pulse animation).

## System Detail Card

**Shared component** invoked from any visualization. Modal or side panel showing:

- System name
- Owner(s) (color-coded badge)
- Status, Integration type, Category, Lifecycle stage (badges)
- Description
- Includes list (component skills)
- Connects to list (clickable system names that open the corresponding detail card, or highlight in the network graph)
- Flags (if any — e.g., "overlap candidate," "convergence target," "gap priority 1")

## Design Conventions

**Match the existing Blackstone dashboards.** Look at one of the existing dashboards in this repo (Motion Dashboard, Mediation Pipeline, etc.) and match:

- Font family, base font size, body color, background color
- Heading hierarchy and spacing
- Card/panel border style and shadow treatment
- Primary accent color (likely a Blackstone blue)
- Status-pill styling (Production / Development / Concept)

**Owner colors.** Assign a distinct color per owner. Suggested palette:

- Ryan Quadrel — #2E75B6 (Blackstone blue)
- Saim Khan — #E8A317 (amber)
- Omri Cohen — #6B46C1 (purple)
- Joshua Duran — #0E9F6E (green)
- Doron Reiffman — #14B8A6 (teal, shown when paired with JD)
- Brett Ferguson — #DC2626 (red, shown when paired with Saim)
- Jonathan Genish — #1F2937 (slate)
- Firm — #6B7280 (gray, for ownership-TBD concepts)

Joint-owned systems render with a two-color badge or gradient split.

**Hypothetical styling.** Hypothetical systems (`is_hypothetical: true`) render with dashed borders and reduced opacity so they're visually distinct from production / development / concept systems in the main inventory.

## Tech Stack

- Single HTML file with embedded `<style>` and `<script>` blocks (or separate files if repo convention prefers that)
- D3.js via CDN (for force-directed network graph)
- Vanilla JS for everything else
- No build tooling required beyond what the repo already uses
- No backend; JSON loaded via `fetch()` at page load

Avoid heavy frameworks. The existing dashboards are vanilla; match that.

## Deployment

- Add the `ai-portfolio.html` file (or `ai-portfolio/` directory) to the repo
- Confirm routing picks it up via the existing Railway deploy pipeline
- Link it from the Mission Control landing page alongside the other dashboards
- Test the deployed URL; confirm all 5 visualizations render and interactivity works

## Acceptance Criteria

- All ~50 systems (including hypotheticals) appear in at least one visualization
- Network graph renders with proper edge connections and owner coloring
- Hover and click interactions work across all visualizations
- Filters (category, owner, status, hypothetical) work on the network graph
- Overlaps/gaps/seams panel surfaces every entry from the JSON
- Page loads in under 3 seconds on a standard firm laptop
- Mobile layout is readable (not necessarily optimized — desktop-primary)
- Styling is visually consistent with the other Blackstone dashboards

## Out of Scope for This Build

- Editing UI (adding/modifying systems from the page). The JSON is the source; edits happen in source control.
- Authentication. This dashboard can live at the same access level as the other Railway dashboards.
- Real-time updates. Static data per build; future enhancement could pull from Supabase or a GitHub-committed JSON.
- Automated data feeds from GitHub/Teams/Outlook/Granola (that's Phase 2 of the coordination framework rollout — not this build).

## Future Enhancements (Explicitly Deferred)

- Wire automation feeds into the JSON (GitHub commits, Railway deploys, Granola action items, Teams activity)
- Add an edit-from-web UI for committee members to self-update their entries
- Add a decision-log view tracking what was discussed / resolved at committee standups
- Add a Phase 4 quarterly-review view showing quarter-over-quarter changes

## Handoff Checklist

- [ ] `ai-portfolio-data.json` present in repo (copy from LA Solar folder)
- [ ] `ai-portfolio-dashboard-build-spec.md` present in repo (this file)
- [ ] Existing dashboard file reviewed for style reference
- [ ] Deployment target confirmed (Railway route)
- [ ] Mission Control landing page linked to new route after deploy
