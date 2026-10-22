<div align="center">

# 📊 Power BI Plugins

**Power BI custom visual plugins for easier dashboard visual creation**

Made by **angelicioux**

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

## 🧩 Plugin categories

Each category has its **own branch**. Inside it, every plugin has its own folder, and the branch README summarises them all. Use the branch dropdown at the top of the repo, or the links below.

| Category | Branch | Plugins | Status |
|---|---|---|---|
| 🃏 **Card** | [`Card`](https://github.com/angelicioux/Power-BI-Plugins/tree/Card) | KPI and headline-number visuals | ✅ 1 available |
| 📈 **Graph** | `Graph` | Chart visuals | 🚧 Coming soon |
| 🗺️ **Maps** | `Maps` | Map visuals | 🚧 Coming soon |

### 🃏 Card plugins

| Plugin | Summary | Version | Docs |
|---|---|---|---|
| **[angcx_ Multicard Plugin](https://github.com/angelicioux/Power-BI-Plugins/tree/Card/angcx_MulticardPlugin)** | Shows several KPI cards in one visual, each with a value, a colour-coded comparison against last year, month, week or day, a sub heading, and per-card formatting with drill-through. | `1.0.3.0` | [README](https://github.com/angelicioux/Power-BI-Plugins/blob/Card/angcx_MulticardPlugin/README.md) · [DAX](https://github.com/angelicioux/Power-BI-Plugins/tree/Card/angcx_MulticardPlugin/docs) |
| angcx_ Colorful Plugin | Coming soon | – | – |

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

# clone one category branch, then open the plugin's folder
git clone -b Card https://github.com/angelicioux/Power-BI-Plugins.git
cd Power-BI-Plugins/angcx_MulticardPlugin

npm install
pbiviz package        # creates dist/<name>.pbiviz
```

---

## 🌿 Repository structure

```
Power-BI-Plugins
├── main                          ← this overview
├── Card                          ← card plugins
│   ├── README.md                 ← summary of every card plugin
│   ├── angcx_MulticardPlugin/    ← multi-card KPI visual
│   └── angcx_ColorfulPlugin/     ← coming soon
├── Graph                         ← coming soon
└── Maps                          ← coming soon
```

---

## 🗺️ Roadmap

- [x] Multicard KPI plugin
- [ ] Sparkline / trend inside cards
- [ ] Progress-to-target bar
- [ ] Several comparisons per card (e.g. vs last year **and** last month)
- [ ] angcx_ Colorful Plugin (Card)
- [ ] Graph plugins
- [ ] Maps plugins

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
