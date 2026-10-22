<div align="center">

# 🃏 Card Plugins

**Power BI card-type custom visuals by angelicioux**

[← Power BI Plugins home](https://github.com/angelicioux/Power-BI-Plugins)

</div>

---

Card plugins show headline numbers (KPIs) at a glance. Each plugin is in its own folder on this branch, with its source code, documentation and DAX examples.

## 🧩 Plugins

| Plugin | Status | Summary | Docs | Download |
|---|---|---|---|---|
| **[angcx_ Multicard Plugin](./angcx_MulticardPlugin)** | ✅ Available `v1.0.3.0` | Shows several KPI cards in one visual, each with a value, a colour-coded comparison against last year, month, week or day, a sub heading, and per-card formatting with drill-through. | [README](./angcx_MulticardPlugin/README.md) · [DAX](./angcx_MulticardPlugin/docs) | [Releases](https://github.com/angelicioux/Power-BI-Plugins/releases) |
| **angcx_ Colorful Plugin** | 🚧 Coming soon | *Description coming soon.* | – | – |

## 📁 Branch structure

```
Card
├── README.md                  ← this page
├── angcx_MulticardPlugin/     ← multi-card KPI visual
└── angcx_ColorfulPlugin/      ← coming soon
```

## 🚀 Install

1. Download the plugin's `.pbiviz` from **[Releases](https://github.com/angelicioux/Power-BI-Plugins/releases)**.
2. In Power BI Desktop: **Visualizations** pane → **…** → **Import a visual from a file**.

## 🛠️ Build a plugin from source

```bash
npm install -g powerbi-visuals-tools
git clone -b Card https://github.com/angelicioux/Power-BI-Plugins.git
cd Power-BI-Plugins/angcx_MulticardPlugin
npm install
pbiviz package        # creates dist/<name>.pbiviz
```

<div align="center">

Made with ☕ by **angcx_**

</div>
