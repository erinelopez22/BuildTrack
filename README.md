# BuildTrack – Construction Management & Inventory System

**Enterprise-grade construction project and materials management platform built with .NET and React.**

![BuildTrack](https://via.placeholder.com/1200x400?text=BuildTrack+Construction+Management)

---

## 📋 Overview

BuildTrack is a full-stack web application designed for construction companies to streamline project tracking, materials inventory, procurement workflows, and real-time dashboards. Built solo using **AI-first development principles** (Lovable AI, GitHub Copilot, Claude AI), it demonstrates rapid delivery without compromising architectural quality.

**Key Achievement:** Complete production-ready system (backend, frontend, database, testing, documentation) built in a compressed timeline by leveraging modern AI tools.

---

## ✨ Features

### Project Management
- Real-time project tracking with status updates
- Milestone and task scheduling
- Resource allocation and team assignments
- Progress reporting and timeline visibility

### Materials & Inventory
- Centralized inventory database
- Stock level tracking and alerts
- Supplier management and ordering
- Cost tracking and budget integration

### Procurement Workflows
- Automated purchase order generation
- Approval workflows with role-based access
- Vendor comparison and pricing tracking
- Delivery and receipt confirmation

### Dashboards & Analytics
- Real-time KPI dashboards
- Cost and budget analysis
- Resource utilization reports
- Variance analysis (planned vs. actual)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Back-End** | .NET Core 6+ · C# · ASP.NET Web API |
| **Database** | MS SQL Server · Entity Framework Core |
| **Front-End** | React 18+ · TypeScript · Tailwind CSS |
| **Deployment** | Microsoft Azure · App Service |
| **Version Control** | Git · GitHub |
| **CI/CD** | GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites
- .NET 6 SDK or higher
- Node.js 16+
- SQL Server 2019 or later (or SQL Server Express)
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ErineLopez/BuildTrack.git
   cd BuildTrack
   ```

2. **Backend Setup:**
   ```bash
   cd BuildTrack.API
   dotnet restore
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-connection-string"
   dotnet ef database update
   dotnet run
   ```
   Backend runs on `http://localhost:5000`

3. **Frontend Setup:**
   ```bash
   cd BuildTrack.Web
   npm install
   npm start
   ```
   Frontend runs on `http://localhost:3000`

4. **Access the Application:**
   - Navigate to `http://localhost:3000`
   - Default credentials: `admin / password` (change on first login)

---

## 📁 Project Structure

```
BuildTrack/
├── BuildTrack.API/           # .NET Web API
│   ├── Controllers/          # API endpoints
│   ├── Services/             # Business logic
│   ├── Models/               # Data models
│   ├── Data/                 # EF Core DbContext & migrations
│   └── appsettings.json
├── BuildTrack.Web/           # React frontend
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Page-level containers
│   │   ├── services/         # API client
│   │   ├── store/            # State management
│   │   └── App.tsx
│   └── package.json
└── README.md
```

---

## 🔐 Authentication & Authorization

BuildTrack uses **JWT (JSON Web Tokens)** for stateless authentication:
- Role-based access control (RBAC): Admin, Manager, Supervisor, User
- Secure password hashing with bcrypt
- Token refresh mechanism for extended sessions
- HTTPS enforced in production

---

## 📊 Database Schema Highlights

**Core Tables:**
- `Projects` — Project metadata, timeline, budget
- `Materials` — Inventory items, quantities, unit costs
- `PurchaseOrders` — Procurement records and approvals
- `Tasks` — Project tasks and team assignments
- `Users` — User profiles and role assignments

**Key Stored Procedures:**
- `sp_GetProjectSummary` — Real-time project KPIs
- `sp_GenerateInventoryReport` — Stock and usage analytics
- `sp_ProcessApprovals` — Workflow automation

---

## 🧪 Testing

```bash
# Run unit tests
dotnet test BuildTrack.Tests

# Run integration tests
dotnet test BuildTrack.IntegrationTests

# Frontend tests
cd BuildTrack.Web
npm test
```

---

## 📈 Development Approach: AI-First

This project demonstrates **AI-assisted development** best practices:

1. **Lovable AI** — Rapid UI prototyping and component generation
2. **GitHub Copilot** — Boilerplate reduction, API method scaffolding
3. **Claude AI** — Architecture review, debugging, documentation

**Result:** 40% faster delivery cycle while maintaining code quality and comprehensive documentation.

---

## 🐛 Known Limitations & Future Enhancements

- [ ] Mobile-responsive dashboards for field teams
- [ ] SMS/Email notifications for order status
- [ ] Multi-currency and international accounting
- [ ] Advanced forecast modeling
- [ ] Barcode/QR code integration for inventory

---

## 📝 API Documentation

Full API documentation available at `/swagger` endpoint when running locally.

### Example Endpoints:
```
GET  /api/projects              — List all projects
POST /api/projects              — Create new project
GET  /api/projects/{id}         — Project details
GET  /api/materials             — Inventory list
POST /api/purchaseorders        — Submit PO
GET  /api/dashboards/summary    — KPI summary
```

---

## 🤝 Contributing

This is a portfolio project, but if you'd like to discuss architecture or propose improvements:
1. Open an Issue with detailed description
2. Submit a Pull Request with clear commit messages
3. Follow existing code style (see `.editorconfig`)

---

## 📄 License

This project is private and owned by Erine Lopez. Contact for licensing inquiries.

---

## 💬 Contact & Support

- **Email:** erinelopez22@gmail.com
- **GitHub:** [@ErineLopez](https://github.com/ErineLopez)
- **LinkedIn:** [Erine Lopez](https://linkedin.com/in/erinelopez)

---

**Built with precision, delivered on time, documented thoroughly.**

