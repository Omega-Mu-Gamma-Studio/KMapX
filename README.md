# KMapX

> **Boolean expression simplifier powered by the Quine–McCluskey algorithm.**  
> Built by [Omega Mu Gamma Studio](https://github.com/Omega-Mu-Gamma-Studio) · Live at [kmapx.vercel.app](https://kmapx.vercel.app) *(coming soon)*

---

## What is this?

KMapX is a browser-based K-Map (Karnaugh Map) simplification tool that takes any Boolean expression and reduces it to its minimal Sum of Products (SOP) form — the same thing you'd spend 20 minutes doing by hand on paper, done in milliseconds.

Unlike most K-Map tools online that use fragile greedy grouping, **KMapX uses a proper Quine–McCluskey engine** — the same algorithm used in professional EDA (Electronic Design Automation) software. It finds all prime implicants, identifies essential ones, and produces a provably minimal result every time.

---

## Features

- **Quine–McCluskey engine** — not guesswork grouping, actual algorithm-based minimization
- **4-variable K-Map** (A, B, C, D) with Gray code ordering
- **Visual group highlighting** — each prime implicant group gets its own color on the map
- **Prime implicants table** — see every group: its size, minterms covered, and Boolean expression
- **Results summary** — original vs simplified, minterm list, copy-to-clipboard
- **Partial SOP support** — input terms like `AB` or `A'C` and KMapX expands them to full minterms automatically
- **Dark-mode UI** with splash screen — because tools can look good too

---

## Usage

Just open the app, type your Boolean expression, and hit **Simplify**.

**Syntax rules:**
- Variables: `A`, `B`, `C`, `D`
- NOT (complement): apostrophe — `A'`, `B'`
- AND: concatenation — `AB`, `A'BC`
- OR: plus — `AB + CD`

**Examples you can try:**
```
A + B
AB + CD
AB' + A'B
ABC + ABD + A'B'C'
A'B'C'D' + A'BCD + AB'CD + ABCD'
```

---

## How it works

### 1. Parsing
The input expression is parsed into individual SOP terms. Partial terms (e.g., `AB`) are expanded to cover all full minterms they represent (e.g., `AB` → `ABC'D', ABC'D, ABCD', ABCD`).

### 2. Quine–McCluskey minimization
Prime implicants are found iteratively — minterms are grouped, then groups of groups, until no further combinations are possible. Any group that wasn't absorbed is a prime implicant.

### 3. Essential PI selection
A greedy cover algorithm with essential PI extraction selects the minimal set of prime implicants that covers all minterms. Essential PIs (those that uniquely cover a minterm) are always selected first.

### 4. Rendering
The selected prime implicants are mapped back to K-Map coordinates and rendered with color-coded group overlays.

---

## Project structure

```
KMapX/
├── index.html    — markup, splash screen, tab panels
├── style.css     — dark theme, layout, K-Map grid styles
└── app.js        — QM engine + DOM rendering (all logic lives here)
```

No frameworks. No build tools. No dependencies. Open `index.html` and it works.

---

## Local development

```bash
git clone https://github.com/Omega-Mu-Gamma-Studio/KMapX.git
cd KMapX
# Open index.html in your browser — that's it.
```

Or serve it locally if you prefer:
```bash
npx serve .
# or
python -m http.server 8080
```

---

## Background

KMapX started as a Python/Tkinter desktop app built during a Digital Logic course to study K-Map minimization. The original version implemented the full QM algorithm from scratch — prime implicant generation, essential PI extraction, and a Petrick's method fallback — without relying on any libraries for the logic itself.

The web port keeps the same algorithm intact and replaces the Tkinter GUI with a clean browser-based interface, making it accessible without installation.

---

## Team

| Name | Role |
|------|------|
| [@albertofelix08](https://github.com/albertofelix08) | Architecture, QM engine, project lead |
| Contributors welcome | See open issues |

*A project by [Omega Mu Gamma Studio](https://github.com/Omega-Mu-Gamma-Studio) — a multipurpose creative studio building games, interactive experiences, and developer tools.*

---

## License

MIT — use it, study it, build on it.

---

<div align="center">
  <sub>Built with logic gates and questionable sleep schedules · Omega Mu Gamma Studio</sub>
</div>