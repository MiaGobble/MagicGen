import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { BeginnerStarterPage } from "./pages/BeginnerStarterPage";
import { BoosterGenPage } from "./pages/BoosterGenPage";
import { BulkPurchasePage } from "./pages/BulkPurchasePage";
import { DeckPimpingPage } from "./pages/DeckPimpingPage";
import { HomePage } from "./pages/HomePage";
import { PodGeneratorPage } from "./pages/PodGeneratorPage";
import { ProxyToolsPage } from "./pages/ProxyToolsPage";
import { RandomCommanderPage } from "./pages/RandomCommanderPage";
import { SleeveColorPage } from "./pages/SleeveColorPage";
import { DiceColorPage } from "./pages/DiceColorPage";
import { PackWarsPage } from "./pages/PackWarsPage";
import { BudgetDeckPage } from "./pages/BudgetDeckPage";
import { SuppliesPage } from "./pages/SuppliesPage";

// Vite BASE_URL always ends with "/"; React Router basename must not.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="commander" element={<RandomCommanderPage />} />
          <Route path="pod" element={<PodGeneratorPage />} />
          <Route path="pimp" element={<DeckPimpingPage />} />
          <Route path="budget" element={<BudgetDeckPage />} />
          <Route path="booster" element={<BoosterGenPage />} />
          <Route path="pack-wars" element={<PackWarsPage />} />
          <Route path="proxy" element={<ProxyToolsPage />} />
          <Route path="bulk" element={<BulkPurchasePage />} />
          <Route path="supplies" element={<SuppliesPage />} />
          <Route path="sleeves" element={<SleeveColorPage />} />
          <Route path="dice" element={<DiceColorPage />} />
          <Route path="beginner" element={<BeginnerStarterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
