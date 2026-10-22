<div align="center">

# 📊 Power BI Plugins

**Power BI custom visual plugins for easier dashboard visual creation**

Made by **angcx_**

![Power BI](https://img.shields.io/badge/Power%20BI-F2C811?style=for-the-badge&logo=powerbi&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Plugins](https://img.shields.io/badge/plugins-1-0A66C2?style=for-the-badge)
[![Latest release](https://img.shields.io/github/v/release/angelicioux/Power-BI-Plugins?style=for-the-badge&label=latest)](https://github.com/angelicioux/Power-BI-Plugins/releases)

</div>

---

## ✨ About

This repository is a collection of **Power BI custom visuals** I build to make dashboards faster to create and nicer to read. Each plugin:

- 📦 ships as a ready-to-import **`.pbiviz`** file (see [Releases](https://github.com/angelicioux/Power-BI-Plugins/releases))
- 🎨 is configured from the normal Power BI **Format** pane, so no code is needed
- 🧩 includes its full **TypeScript source**, so you can adapt it

---

## 🧩 Plugins

| Plugin | Description | Version | Docs |
|---|---|---|---|
| **[angcx_ Multicard Plugin](./angcx_MulticardPlugin)** | Multi-card KPI visual: title, value, a period-comparison sub value with favourable/unfavourable colours, sub heading, per-card formatting with **fx** conditional formatting, pagination and **drill-through**. | `1.0.3.0` | [README](./angcx_MulticardPlugin/README.md) · [DAX](./angcx_MulticardPlugin/docs) |
| *More coming soon…* | | | |

<details>
<summary><b>angcx_ Multicard Plugin – features</b></summary>

- One card per measure, or one card per category value (e.g. Region)
- Sub value comparison with the change and % (e.g. `+22,160 (6.2%) vs same period 2025`)
- Compare with prior year / month / week / day, a target, or any measure, chosen per card
- Dynamic labels driven by a "Compare to" slicer
- Format pane with **Apply settings to: All / each card**, like the native card visual
- Grid, row or column layout, fixed or auto size, scroll or pagination
- Right-click drill-through on cards and sub values, cross-filtering and tooltips

</details>

---

## 🚀 Install a plugin

1. Go to **[Releases](https://github.com/angelicioux/Power-BI-Plugins/releases)** and download the plugin's `.pbiviz` file.
2. In **Power BI Desktop**, go to the **Visualizations** pane → **…** (Get more visuals) → **Import a visual from a file**.
3. Choose the `.pbiviz` file. The plugin's icon appears in the Visualizations pane.

> 💡 **Power BI Service:** your organisation's admin settings may block custom visuals that aren't certified. If so, ask your admin to allow them or to add the plugin to your organisation's visuals.

---

## 🛠️ Build from source

Requirements: [Node.js](https://nodejs.org) (LTS) and the Power BI visuals tools.

```bash
npm install -g powerbi-visuals-tools

git clone https://github.com/angelicioux/Power-BI-Plugins.git
cd Power-BI-Plugins/angcx_MulticardPlugin

npm install
pbiviz package        # creates dist/<name>.pbiviz
```

---

## 📁 Repository structure

```
Power-BI-Plugins/
├── README.md                    ← you are here
├── angcx_MulticardPlugin/       ← one folder per plugin
│   ├── src/                     ← TypeScript source (visual.ts, settings.ts)
│   ├── style/                   ← styles (.less)
│   ├── assets/                  ← icon
│   ├── docs/                    ← DAX examples and guides
│   ├── capabilities.json        ← field wells and format options
│   ├── pbiviz.json              ← name, version, author
│   └── README.md                ← plugin documentation
└── <next plugin>/
```

---

## 🗺️ Roadmap

- [x] Multicard KPI plugin
- [ ] Sparkline / trend inside cards
- [ ] Progress-to-target bar
- [ ] Several comparisons per card (e.g. vs last year **and** last month)
- [ ] More plugins…

Have an idea? [Open an issue](https://github.com/angelicioux/Power-BI-Plugins/issues) 💬

---

## 🤝 Contributing

Bug reports, ideas and pull requests are welcome.

1. Fork the repo and create a branch: `git checkout -b feature/my-idea`
2. Make your changes and run `pbiviz package` to check that the plugin builds
3. Open a pull request describing what changed

---

## 📄 License

Released under the [MIT License](./LICENSE). You're free to use and adapt these plugins; please keep the credit.

<div align="center">

Made with ☕ by **angcx_** · ⭐ Star this repo if you find it useful!

</div>
