# Bondtex Production Tracking Dashboard System (MES)

A modern, high-performance manufacturing tracking dashboard system built for **Bondtex**, specializing in apparel, elastic narrow fabrics, webbing straps, knitted t-shirts, and garment trims.

Located at: `C:\Users\ASUS\Desktop\Bondtex\system`

---

## 🌟 Key Features

### 1. Main Dashboard Page
- **4 Main Production Categories**:
  - 🔄 **Loop**: Elastic loops, hook & loop fasteners, pull tabs, ring closures.
  - 📑 **Strap**: Military/commercial nylon webbings, backpack harness bands, cargo binding straps.
  - 👕 **T-shirt**: Combed cotton crewneck, polo blanks, activewear compression, seamless knits.
  - 📦 **Other**: Damask woven labels, drawcords with silicone aglets, heat seal emblems, PU zipper tapes.
- **Key Metric Cards** (available at factory level & per category):
  - **Order Qty**: Total ordered pieces booked under contracts.
  - **Production Qty**: Total units manufactured so far, with completion progress bars.
  - **Delivery Qty**: Total dispatched volume and fulfillment rate %.
  - **Balance Qty**: Remaining pieces to manufacture and dispatch.
  - **Plan vs Actual Qty**: Dynamic Recharts graphic comparing daily planned targets vs. actual daily factory output.
- **Category Deep Dive Modal / View**:
  - Clicking any category (e.g., Loop) from the sidebar or card grid opens its full performance breakdown, key metrics, style distribution, and Plan vs Actual time series chart.

### 3. Admin Panel & Static QR Generation
- **Machine Station Configuration**:
  - Admin selects a machine (e.g., `Machine 01 - Santoni Loom L1`, `Machine 02`, etc.) or registers a new line.
  - Configures **Assigned Colours** (multi-select from `Black 093 54A2`, `Marzipan 39H6`, `Praline 65H8`, `Ganache 33F6`, `Talc 69-09-47 57H1`).
  - Configures **Assigned Sizes** (multi-select from `10`, `12`, `14`, `16`, `18`).
  - Assigns Station Operator, Shift (`Shift A`, `Shift B`, `Shift C`), and Daily Quota Target (e.g., `2,500` pcs/day).
- **Permanent / Static Machine QR Generation**:
  - Generates a permanent, static QR code bound to that machine's unique station ID.
  - **Does NOT change** when production logs or batches are recorded.
  - **Print Laminated Badge**: Opens a clean, print-ready identification card with high-res QR code, station ID, operator name, and assigned scopes ready for clipping to the physical machine.

### 4. Worker / Operator Mobile Interface (QR Scan Flow)
- **Instant Pre-Populated Dropdowns**:
  - Scanning the physical machine QR code (or opening `/?view=worker&machine=MCH-01`) opens the mobile touch interface.
  - Dropdowns **automatically filter** to only show the Styles, Colours, and Sizes configured by the admin for that specific machine!
- **Real-Time Target Gauge & Remaining Calculator**:
  - Worker enters produced quantity (with quick-add touch buttons: `+50`, `+100`, `+250`, `+500`, `+1000`).
  - **Live display computes remaining pieces for today's target**:
    `Remaining = Daily Quota - (Already Produced + Current Input)`.
  - Visual progress bar fills in real-time as the worker types.
  - Instant notification when the daily target is achieved (`+X pcs bonus!`).
- **Real-Time Dashboard Sync**:
  - Submitting a batch immediately writes to the backend database, updates the machine's shift log, increases the PO's `productionQty`, recalculates `balanceQty`, and syncs with the Executive Plan vs Actual charts.
- **Real Production Data Schema**:
  - **PO #**: Authentic purchase order numbers (e.g., `4502991550`, `4502991532`, `4502991599`, `4502991520`, `4502991562`, `4502991557`, `4502991538`, `4502991603`, `4502991526`).
  - **RM Material**: Raw material codes (e.g., `200150259454A2`, `200150259439H6`, `200150259465H8`, `200150259433F6`, `200150259457H1`).
  - **Colour**: Exact shade names (e.g., `Black 093 54A2`, `Marzipan 39H6`, `Praline 65H8`, `Ganache 33F6`, `Talc 69-09-47 57H1`).
  - **Size**: Exact production garment / trim sizes (`10`, `12`, `14`, `16`, `18`).
  - **Category**: `Loop`, `Strap`, `T-shirt`, and `Other`.
- **Advanced Search & Dynamic Filters**:
  - **PO / Barcode / RM / Colour search**: Instant typing or barcode scan.
  - **Dynamic Dropdowns**: Populated directly from dataset without placeholder names:
    - PO # Dropdown
    - RM Material Dropdown
    - Colour Dropdown
    - Size Dropdown (`10`, `12`, `14`, `16`, `18`)
    - Style Dropdown
    - Category Tabs (`All`, `Loop`, `Strap`, `T-shirt`, `Other`)
    - Date Range Selectors
- **Comprehensive Data Table**:
  - Full visibility for: `PO #`, `RM Material`, `Colour`, `Size`, `Category`, `Style`, `Order Qty`, `Production Qty`, `Delivery Qty`, `Balance Qty`, `Plan vs Actual Status`, and `Actions`.
  - **Interactive Actions**:
    - 📈 **View Daily Tracking**: Day-by-day progression chart and logs table.
    - ✏️ **Log Daily Production**: Quick modal for shift supervisors to enter today's output.
    - 🏷️ **Print Barcode Label**: High-resolution printable barcode sticker preview.
  - **CSV / Excel Export**: One-click download of filtered production datasets.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v25+)
- npm

### Installation & Quick Start
From `C:\Users\ASUS\Desktop\Bondtex\system`:

```bash
# 1. Install dependencies (already installed)
npm install

# 2. Run both Backend API and Vite Frontend concurrently
npm run dev
```

- **Frontend (Vite HMR)**: [http://localhost:3000](http://localhost:3000)
- **Backend API (Express)**: [http://localhost:5000](http://localhost:5000)

### Production Build & Run

```bash
# Build optimized client assets
npm run build

# Start production server (serves both API & Frontend on port 5000)
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

### Re-seed Initial Demo Data
To reset the production tracking database back to default seed records:

```bash
npm run seed
```
Or click the **Reset Data** button in the dashboard top navigation bar.

---

## 📡 RESTful API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/overview` | Factory totals (Order, Production, Delivery, Balance) + category summaries |
| `GET` | `/api/categories` | Summary for all 4 categories (Loop, Strap, T-shirt, Other) |
| `GET` | `/api/categories/:category` | Detailed metrics and style breakdown for a single category |
| `GET` | `/api/orders` | Filtered orders by search, category, style, size, date range, status, sort |
| `GET` | `/api/orders/:id` | Full order record with day-by-day logs |
| `POST` | `/api/orders` | Create a new production order |
| `POST` | `/api/orders/:id/logs` | Log daily planned vs actual output |
| `GET` | `/api/plan-vs-actual` | Dynamic time-series data for Plan vs Actual charts |
| `GET` | `/api/barcode/:code` | Barcode lookup endpoint |
| `GET` | `/api/metadata` | Distinct styles and sizes for dropdown filters |
| `GET` | `/api/export/csv` | Download filtered records as CSV |
| `POST` | `/api/reset` | Reset database to clean seed records |

---

## 🛠️ Tech Stack
- **Frontend**: React 19, Tailwind CSS v4, Lucide React Icons, Recharts (Dynamic charts)
- **Tooling**: Vite 8, Concurrently
- **Backend**: Node.js, Express 5, CORS, File-persisted JSON Database
- **Typography & UI**: Plus Jakarta Sans, JetBrains Mono, Dark Glassmorphism aesthetics
