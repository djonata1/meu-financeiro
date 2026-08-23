"use client";

import { supabase } from "@/utils/client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type Theme = "dark" | "light";
type Page =
  | "dashboard"
  | "transactions"
  | "bills"
  | "cards"
  | "goals"
  | "investments"
  | "reports"
  | "settings";

type TransactionType = "income" | "expense";

type Transaction = {
  id: number;
  description: string;
  category: string;
  account: string;
  date: string;
  amount: number;
  type: TransactionType;
  color?: string;
};

type Bill = {
  id: number;
  description: string;
  category: string;
  dueDate: string;
  amount: number;
  paid: boolean;
};

type Card = {
  id: number;
  name: string;
  brand: string;
  last4: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  invoicePaidMonth?: string;
  invoicePaidDate?: string;
};

type CardPurchase = {
  id: number;
  cardId: number;
  description: string;
  category: string;
  date: string;
  total: number;
  installments: number;
  installmentValue: number;
  currentInstallment: number;
};

type Goal = {
  id: number;
  name: string;
  target: number;
  current: number;
  deadline: string;
  icon: string;
};

type Investment = {
  id: number;
  name: string;
  invested: number;
  value: number;
};

const STORAGE = {
  theme: "meu-financeiro-theme",
  transactions: "meu-financeiro-transactions",
  bills: "meu-financeiro-bills",
  cards: "meu-financeiro-cards",
  purchases: "meu-financeiro-purchases",
  goals: "meu-financeiro-goals",
  investments: "meu-financeiro-investments",
};

const initialTransactions: Transaction[] = [
  {
    id: 1,
    description: "Salário",
    category: "Salário",
    account: "Nubank",
    date: "2026-08-19",
    amount: 2800,
    type: "income",
  },
  {
    id: 2,
    description: "Aluguel",
    category: "Casa",
    account: "Nubank",
    date: "2026-08-10",
    amount: 1500,
    type: "expense",
  },
  {
    id: 3,
    description: "Supermercado",
    category: "Alimentação",
    account: "Nubank",
    date: "2026-08-18",
    amount: 187.4,
    type: "expense",
  },
  {
    id: 4,
    description: "Internet",
    category: "Casa",
    account: "Nubank",
    date: "2026-08-08",
    amount: 100,
    type: "expense",
  },
  {
    id: 5,
    description: "Uber",
    category: "Transporte",
    account: "Nubank",
    date: "2026-08-07",
    amount: 24.3,
    type: "expense",
  },
];

const initialBills: Bill[] = [
  {
    id: 1,
    description: "Aluguel",
    category: "Casa",
    dueDate: "2026-08-10",
    amount: 1500,
    paid: false,
  },
  {
    id: 2,
    description: "Internet",
    category: "Casa",
    dueDate: "2026-08-15",
    amount: 100,
    paid: true,
  },
  {
    id: 3,
    description: "Luz",
    category: "Casa",
    dueDate: "2026-08-20",
    amount: 180,
    paid: false,
  },
  {
    id: 4,
    description: "Água",
    category: "Casa",
    dueDate: "2026-08-22",
    amount: 70,
    paid: false,
  },
];

const initialCards: Card[] = [
  {
    id: 1,
    name: "Nubank",
    brand: "VISA",
    last4: "4281",
    limit: 3000,
    closingDay: 2,
    dueDay: 10,
  },
  {
    id: 2,
    name: "Inter",
    brand: "MASTERCARD",
    last4: "9017",
    limit: 5000,
    closingDay: 12,
    dueDay: 20,
  },
];

const initialPurchases: CardPurchase[] = [
  {
    id: 1,
    cardId: 1,
    description: "Supermercado",
    category: "Alimentação",
    date: "2026-08-18",
    total: 187.4,
    installments: 1,
    installmentValue: 187.4,
    currentInstallment: 1,
  },
  {
    id: 2,
    cardId: 1,
    description: "Tênis",
    category: "Compras",
    date: "2026-08-05",
    total: 600,
    installments: 6,
    installmentValue: 100,
    currentInstallment: 1,
  },
];

const initialGoals: Goal[] = [
  {
    id: 1,
    name: "Comprar um carro",
    target: 30000,
    current: 12000,
    deadline: "2027-12-01",
    icon: "🚗",
  },
  {
    id: 2,
    name: "Reserva de emergência",
    target: 10000,
    current: 5000,
    deadline: "2027-06-01",
    icon: "🛡️",
  },
  {
    id: 3,
    name: "Viagem",
    target: 8000,
    current: 2500,
    deadline: "2027-01-01",
    icon: "✈️",
  },
];

const initialInvestments: Investment[] = [
  { id: 1, name: "Bitcoin", invested: 2500, value: 2500 },
  { id: 2, name: "Ethereum", invested: 1800, value: 1800 },
  { id: 3, name: "Renda fixa", invested: 2650, value: 2650 },
  { id: 4, name: "Ações", invested: 1500, value: 1500 },
];

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function currentCalendarMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function invoiceStatusForCard(card: Card, now = new Date()) {
  const monthKey = currentCalendarMonthKey(now);

  // If the user has already paid this month's invoice, keep it paid.
  if (card.invoicePaidMonth === monthKey) {
    return "paid" as const;
  }

  // Before the due date there is no "pending" warning.
  // On/after the due date it becomes pending until paid.
  const today = now.getDate();
  const dueDay = Math.min(Math.max(card.dueDay || 1, 1), 31);

  return today >= dueDay ? ("pending" as const) : ("upcoming" as const);
}

function dateBR(date: string) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

const MONTH_MARKER = "__MEU_FINANCEIRO_MONTH_START__";

function monthKeyFromDate(date: string) {
  return date ? date.slice(0, 7) : "";
}

function isMonthMarker(transaction: Transaction) {
  return transaction.description === MONTH_MARKER;
}

function resolveCurrentMonth(_items: Transaction[]) {
  // O mês atual acompanha o calendário. Os meses anteriores continuam
  // armazenados e podem ser consultados pelo seletor de mês.
  return currentCalendarMonthKey();
}

function nextMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  if (!month) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (char) => char.toUpperCase());
}

function dateForMonth(month: string) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (month === todayKey) {
    return `${todayKey}-${String(today.getDate()).padStart(2, "0")}`;
  }
  return `${month}-01`;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function Icon({
  name,
  size = 19,
}: {
  name: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    transactions: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <circle cx="8" cy="6" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="10" cy="18" r="1.5" />
      </>
    ),
    bills: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 2 5-7" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L7.3 8.6 9 6.9l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    arrowUp: (
      <>
        <path d="m5 12 7-7 7 7" />
        <path d="M12 19V5" />
      </>
    ),
    arrowDown: (
      <>
        <path d="m19 12-7 7-7-7" />
        <path d="M12 5v14" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
        <path d="M16 13h4" />
        <circle cx="16" cy="13" r=".7" fill="currentColor" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: (
      <>
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
      </>
    ),
    edit: (
      <>
        <path d="m4 20 4-.8L19 8.2a2 2 0 0 0-3-3L5 16.2 4 20Z" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.dashboard}</svg>;
}

function MiniChart({
  dark,
  interactive = false,
  transactions,
  month,
}: {
  dark: boolean;
  interactive?: boolean;
  transactions?: Transaction[];
  month?: string;
}) {
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const chartId = useId().replace(/:/g, "");
  const isRealData = Boolean(month);

  const demoGreenValues = [
    2200, 2350, 2280, 2500, 2450, 2650, 2580,
    2780, 2700, 2900, 2820, 3000, 2920, 2800,
  ];

  const demoRedValues = [
    1200, 1350, 1280, 1450, 1400, 1550, 1480,
    1680, 1600, 1780, 1700, 1850, 1760, 1811.7,
  ];

  const chartData = useMemo(() => {
    if (!isRealData || !month) {
      return demoGreenValues.map((incomeValue, index) => ({
        date: "",
        label: "",
        income: incomeValue,
        expense: demoRedValues[index] ?? 0,
      }));
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const source = transactions ?? [];

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const dayTransactions = source.filter((item) => item.date === date);

      return {
        date,
        label: String(day).padStart(2, "0"),
        income: dayTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + item.amount, 0),
        expense: dayTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + item.amount, 0),
      };
    });
  }, [isRealData, month, transactions]);

  const totalIncome = useMemo(
    () => chartData.reduce((sum, item) => sum + item.income, 0),
    [chartData]
  );

  const totalExpense = useMemo(
    () => chartData.reduce((sum, item) => sum + item.expense, 0),
    [chartData]
  );

  const totalBalance = totalIncome - totalExpense;

  const width = 760;
  const height = 290;
  const padding = { top: 20, right: 16, bottom: 30, left: 4 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...chartData.map((item) => Math.max(item.income, item.expense))
  );
  const visualMax = maxValue * 1.14;

  const coords = chartData.map((item, index) => {
    const x =
      chartData.length === 1
        ? width / 2
        : padding.left + (index / (chartData.length - 1)) * innerWidth;

    return {
      x,
      incomeY:
        padding.top +
        innerHeight -
        (item.income / visualMax) * innerHeight,
      expenseY:
        padding.top +
        innerHeight -
        (item.expense / visualMax) * innerHeight,
    };
  });

  // Curva Bézier suave, mantendo os valores reais de cada dia.
  const makeSmoothPath = (key: "incomeY" | "expenseY") => {
    if (!coords.length) return "";

    if (coords.length === 1) {
      return `M ${coords[0].x} ${coords[0][key]}`;
    }

    let path = `M ${coords[0].x} ${coords[0][key]}`;

    for (let index = 1; index < coords.length; index += 1) {
      const previous = coords[index - 1];
      const current = coords[index];
      const next = coords[index + 1] ?? current;

      const cp1x = previous.x + (current.x - (coords[index - 2]?.x ?? previous.x)) / 6;
      const cp1y =
        previous[key] +
        (current[key] - (coords[index - 2]?.[key] ?? previous[key])) / 6;

      const cp2x = current.x - (next.x - previous.x) / 6;
      const cp2y = current[key] - (next[key] - previous[key]) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current[key]}`;
    }

    return path;
  };

  const incomePath = makeSmoothPath("incomeY");
  const expensePath = makeSmoothPath("expenseY");
  const baselineY = padding.top + innerHeight;

  const incomeAreaPath = chartData.length
    ? `${incomePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`
    : "";

  const expenseAreaPath = chartData.length
    ? `${expensePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`
    : "";

  const tooltipIndex =
    activePoint === null
      ? null
      : Math.min(activePoint, Math.max(chartData.length - 1, 0));

  const activeData =
    tooltipIndex !== null ? chartData[tooltipIndex] : null;
  const activeCoord =
    tooltipIndex !== null ? coords[tooltipIndex] : null;

  const labelIndices = isRealData
    ? Array.from(
        new Set(
          [0, 7, 14, 21, chartData.length - 1].filter(
            (index) => index >= 0 && index < chartData.length
          )
        )
      )
    : [0, 7, 14, 21, 28].filter(
        (index) => index >= 0 && index < chartData.length
      );

  const gridValues = [0.25, 0.5, 0.75, 1];

  return (
    <div className={`mini-chart-wrap ${isRealData ? "chart-real-data" : ""}`}>
      {isRealData && (
        <div className="chart-summary">
          <div className="chart-summary-card income-card">
            <span>ENTRADAS NO PERÍODO</span>
            <strong className="chart-summary-income">{money(totalIncome)}</strong>
          </div>

          <div className="chart-summary-card expense-card">
            <span>GASTOS NO PERÍODO</span>
            <strong className="chart-summary-expense">{money(totalExpense)}</strong>
          </div>

          <div className={`chart-summary-card ${totalBalance >= 0 ? "balance-card" : "balance-card negative"}`}>
            <span>SALDO DO PERÍODO</span>
            <strong className={totalBalance >= 0 ? "chart-summary-income" : "chart-summary-expense"}>
              {money(totalBalance)}
            </strong>
          </div>
        </div>
      )}

      <div className="chart-canvas">
        <div className="premium-chart-stage">
          {isRealData && (
            <div className="premium-chart-yaxis" aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                <span key={ratio}>
                  {money(Math.round(visualMax * ratio / 100) * 100)}
                </span>
              ))}
            </div>
          )}

        <svg
          width="100%"
          height={isRealData ? "285" : "265"}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="chart-svg"
          style={{ touchAction: "pan-y" }}
          onPointerLeave={(event) => {
            if (interactive && event.pointerType === "mouse") {
              setActivePoint(null);
            }
          }}
        >
          <defs>
            <linearGradient id={`incomeArea-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#39e58b" stopOpacity=".28" />
              <stop offset="48%" stopColor="#39e58b" stopOpacity=".09" />
              <stop offset="100%" stopColor="#39e58b" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`expenseArea-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6171" stopOpacity=".20" />
              <stop offset="48%" stopColor="#ff6171" stopOpacity=".06" />
              <stop offset="100%" stopColor="#ff6171" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`incomeLine-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#29d97f" />
              <stop offset="50%" stopColor="#4af39b" />
              <stop offset="100%" stopColor="#20c878" />
            </linearGradient>

            <linearGradient id={`expenseLine-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff5365" />
              <stop offset="50%" stopColor="#ff7a86" />
              <stop offset="100%" stopColor="#ff5f70" />
            </linearGradient>

            <filter id={`softGlow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id={`pointGlow-${chartId}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {gridValues.map((ratio) => {
            const y = padding.top + innerHeight - innerHeight * ratio;

            return (
              <line
                key={ratio}
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke={dark ? "#253449" : "#dce5ef"}
                strokeWidth="1"
                strokeDasharray="2 8"
                opacity={dark ? ".8" : ".9"}
              />
            );
          })}

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={baselineY}
            y2={baselineY}
            stroke={dark ? "#314158" : "#d6e0eb"}
            strokeWidth="1"
          />

          <path
            d={incomeAreaPath}
            fill={`url(#incomeArea-${chartId})`}
            stroke="none"
          />

          <path
            d={expenseAreaPath}
            fill={`url(#expenseArea-${chartId})`}
            stroke="none"
          />

          <path
            d={incomePath}
            fill="none"
            stroke="#39e58b"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".10"
            filter={`url(#softGlow-${chartId})`}
          />

          <path
            d={expensePath}
            fill="none"
            stroke="#ff6171"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".08"
            filter={`url(#softGlow-${chartId})`}
          />

          <path
            d={incomePath}
            fill="none"
            stroke={`url(#incomeLine-${chartId})`}
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={expensePath}
            fill="none"
            stroke={`url(#expenseLine-${chartId})`}
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {interactive &&
            coords.map((point, index) => {
              const item = chartData[index];
              const hasActivity = item.income > 0 || item.expense > 0;
              const isActive = activePoint === index;

              return (
                <g key={`point-${index}`}>
                  <circle
                    cx={point.x}
                    cy={height / 2}
                    r={Math.max(16, width / Math.max(chartData.length * 1.5, 1))}
                    fill="transparent"
                    style={{ cursor: "crosshair" }}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setActivePoint(index);
                    }}
                    onPointerMove={() => setActivePoint(index)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setActivePoint(index);
                    }}
                  />

                  {hasActivity && (
                    <>
                      <circle
                        cx={point.x}
                        cy={point.incomeY}
                        r={isActive ? 8 : 4}
                        fill="#39e58b"
                        opacity={isActive ? ".18" : ".08"}
                        filter={`url(#pointGlow-${chartId})`}
                        pointerEvents="none"
                      />
                      <circle
                        cx={point.x}
                        cy={point.incomeY}
                        r={isActive ? 5.5 : 3}
                        fill={dark ? "#0c1622" : "#ffffff"}
                        stroke="#39e58b"
                        strokeWidth={isActive ? 2.5 : 1.8}
                        pointerEvents="none"
                      />

                      <circle
                        cx={point.x}
                        cy={point.expenseY}
                        r={isActive ? 8 : 4}
                        fill="#ff6171"
                        opacity={isActive ? ".16" : ".07"}
                        filter={`url(#pointGlow-${chartId})`}
                        pointerEvents="none"
                      />
                      <circle
                        cx={point.x}
                        cy={point.expenseY}
                        r={isActive ? 5.5 : 3}
                        fill={dark ? "#0c1622" : "#ffffff"}
                        stroke="#ff6171"
                        strokeWidth={isActive ? 2.5 : 1.8}
                        pointerEvents="none"
                      />
                    </>
                  )}

                  {isActive && (
                    <line
                      x1={point.x}
                      x2={point.x}
                      y1={padding.top}
                      y2={baselineY}
                      stroke={dark ? "#71829a" : "#aebdcd"}
                      strokeWidth="1"
                      strokeDasharray="3 6"
                      opacity=".75"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

          {interactive && activeData && activeCoord && (
            <g
              transform={`translate(${Math.min(
                Math.max(activeCoord.x - 92, 5),
                width - 190
              )}, ${Math.max(
                Math.min(
                  Math.min(activeCoord.incomeY, activeCoord.expenseY) - 91,
                  height - 90
                ),
                5
              )})`}
              pointerEvents="none"
            >
              <rect
                width="184"
                height="82"
                rx="13"
                fill={dark ? "#0b1522" : "#ffffff"}
                fillOpacity=".97"
                stroke={dark ? "#30445d" : "#d5dfeb"}
                strokeWidth="1"
              />

              <rect
                x="1"
                y="1"
                width="182"
                height="80"
                rx="12"
                fill="none"
                stroke={dark ? "rgba(255,255,255,.045)" : "rgba(15,23,42,.045)"}
              />

              <text
                x="13"
                y="19"
                fill={dark ? "#9aa9bb" : "#64748b"}
                fontSize="9"
                fontWeight="700"
              >
                {isRealData ? dateBR(activeData.date) : "Fluxo financeiro"}
              </text>

              <circle cx="14" cy="36" r="3.2" fill="#39e58b" />
              <text
                x="23"
                y="39"
                fill={dark ? "#e9f2ec" : "#263243"}
                fontSize="10"
                fontWeight="750"
              >
                Entradas
              </text>
              <text
                x="170"
                y="39"
                textAnchor="end"
                fill="#39e58b"
                fontSize="10"
                fontWeight="800"
              >
                {money(activeData.income)}
              </text>

              <circle cx="14" cy="57" r="3.2" fill="#ff6171" />
              <text
                x="23"
                y="60"
                fill={dark ? "#e9edf2" : "#263243"}
                fontSize="10"
                fontWeight="750"
              >
                Gastos
              </text>
              <text
                x="170"
                y="60"
                textAnchor="end"
                fill="#ff6171"
                fontSize="10"
                fontWeight="800"
              >
                {money(activeData.expense)}
              </text>

              <text
                x="13"
                y="75"
                fill={dark ? "#718198" : "#8491a3"}
                fontSize="8"
                fontWeight="650"
              >
                Saldo do dia
              </text>
              <text
                x="170"
                y="75"
                textAnchor="end"
                fill={activeData.income - activeData.expense >= 0 ? "#39e58b" : "#ff6171"}
                fontSize="8"
                fontWeight="800"
              >
                {money(activeData.income - activeData.expense)}
              </text>
            </g>
          )}
        </svg>
        </div>

        {isRealData && (
          <div className="chart-days">
            {labelIndices.map((index) => (
              <span key={index}>{chartData[index]?.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DonutChart({ total }: { total: number }) {
  return (
    <div className="donut-wrap">
      <div className="donut">
        <div className="donut-center">
          <strong>{money(total)}</strong>
          <span>Total</span>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  dark,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dark: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal ${dark ? "modal-dark" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>Preencha as informações abaixo.</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dark,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  dark: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={dark ? "input input-dark" : "input"}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [page, setPage] = useState<Page>("dashboard");
  const [pageHistory, setPageHistory] = useState<Page[]>(["dashboard"]);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [purchases, setPurchases] =
    useState<CardPurchase[]>(initialPurchases);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [investments, setInvestments] = useState<Investment[]>(initialInvestments);
  const [currentMonth, setCurrentMonth] = useState<string>(() =>
    resolveCurrentMonth(initialTransactions)
  );
  const [viewMonth, setViewMonth] = useState<string>(() =>
    resolveCurrentMonth(initialTransactions)
  );

  const [modal, setModal] = useState<
    "transaction" | "bill" | "purchase" | "goal" | "card" | "investment" | null
  >(null);

  const [selectedCard, setSelectedCard] = useState<number>(1);

  const [transactionForm, setTransactionForm] = useState({
    description: "",
    category: "Alimentação",
    account: "Nubank",
    date: "2026-08-19",
    amount: "",
    type: "expense" as TransactionType,
  });

  const [billForm, setBillForm] = useState({
    description: "",
    category: "Casa",
    dueDate: "2026-08-25",
    amount: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    cardId: "1",
    description: "",
    category: "Compras",
    date: "2026-08-19",
    total: "",
    installments: "1",
  });

  const [goalForm, setGoalForm] = useState({
    name: "",
    target: "",
    current: "",
    deadline: "2027-12-01",
    icon: "🎯",
  });

  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [goalAmountGoal, setGoalAmountGoal] = useState<Goal | null>(null);
  const [goalAmount, setGoalAmount] = useState("");

  const [cardForm, setCardForm] = useState({
    name: "",
    brand: "VISA",
    last4: "",
    limit: "",
    closingDay: "2",
    dueDay: "10",
  });
  const [editingCardId, setEditingCardId] = useState<number | null>(null);

  const [investmentForm, setInvestmentForm] = useState({
    name: "",
    invested: "",
    value: "",
  });
  const [editingInvestmentId, setEditingInvestmentId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [cloudError, setCloudError] = useState("");

  async function loadCloudData(currentUser: any) {
    const { data, error } = await supabase
      .from("finance_user_data")
      .select("theme, transactions, bills, cards, purchases, goals")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
  setCloudError(
    `Não foi possível carregar seus dados financeiros. ${error.message}`
  );
  return;
}

    if (data) {
      if (data.theme === "dark" || data.theme === "light") {
        setTheme(data.theme);
      }
      const cloudTransactions = (data.transactions as Transaction[]) || [];
      const loadedMonth = resolveCurrentMonth(cloudTransactions);
      setCurrentMonth(loadedMonth);
      setViewMonth(loadedMonth);
      setTransactions(cloudTransactions);
      setBills((data.bills as Bill[]) || []);
      setCards((data.cards as Card[]) || []);
      setPurchases((data.purchases as CardPurchase[]) || []);
      setGoals((data.goals as Goal[]) || []);

      const localInvestments = load<Investment[] | null>(
        STORAGE.investments,
        null
      );
      if (localInvestments) {
        setInvestments(localInvestments);
      }
      return;
    }

    // Primeiro acesso: aproveita os dados locais existentes somente para
    // migrar o que já estava neste navegador para a conta atual.
    const localTheme = load<Theme | null>(STORAGE.theme, null);
    const localTransactions = load<Transaction[] | null>(STORAGE.transactions, null);
    const localBills = load<Bill[] | null>(STORAGE.bills, null);
    const localCards = load<Card[] | null>(STORAGE.cards, null);
    const localPurchases = load<CardPurchase[] | null>(STORAGE.purchases, null);
    const localGoals = load<Goal[] | null>(STORAGE.goals, null);
    const localInvestments = load<Investment[] | null>(STORAGE.investments, null);

    if (localInvestments) {
      setInvestments(localInvestments);
    }

    const cloudPayload = {
      user_id: currentUser.id,
      theme: localTheme === "light" || localTheme === "dark" ? localTheme : "dark",
      transactions: localTransactions || initialTransactions,
      bills: localBills || initialBills,
      cards: localCards || initialCards,
      purchases: localPurchases || initialPurchases,
      goals: localGoals || initialGoals,
    };

    const { error: insertError } = await supabase
      .from("finance_user_data")
      .insert(cloudPayload);

    if (insertError) {
      console.error(insertError);
      setCloudError("Não foi possível criar o espaço financeiro da sua conta.");
      return;
    }

    const loadedMonth = resolveCurrentMonth(cloudPayload.transactions);
    setCurrentMonth(loadedMonth);
    setViewMonth(loadedMonth);
    setTheme(cloudPayload.theme);
    setTransactions(cloudPayload.transactions);
    setBills(cloudPayload.bills);
    setCards(cloudPayload.cards);
    setPurchases(cloudPayload.purchases);
    setGoals(cloudPayload.goals);

    // Depois da migração, os dados locais deixam de ser usados como fonte
    // principal. Assim, uma segunda pessoa não herda os dados da primeira.
    Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
  }

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        window.location.href = "/login";
        return;
      }

      if (!mounted) return;

      setUser(data.user);
      await loadCloudData(data.user);

      if (mounted) {
        setCloudReady(true);
        setCheckingAuth(false);
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // O login não pode voltar a aparecer quando o usuário usa o gesto
    // de voltar do iPhone/Android. Substituímos a entrada atual e
    // mantemos uma entrada do próprio financeiro na pilha do navegador.
    // Assim, o gesto de voltar permanece dentro do app.
    const currentUrl = window.location.href;
    const appState = { meuFinanceiro: true, screen: "app" };
    window.history.replaceState(appState, "", currentUrl);
    window.history.pushState(appState, "", currentUrl);

    const keepInsideApp = () => {
      // O app não usa o histórico do navegador para trocar de telas.
      // Portanto, qualquer gesto de voltar deve permanecer dentro do app.
      window.history.pushState(appState, "", currentUrl);
    };

    window.addEventListener("popstate", keepInsideApp);

    return () => {
      window.removeEventListener("popstate", keepInsideApp);
    };
  }, []);

  async function updateCloud(patch: Record<string, unknown>) {
    if (!user?.id) return;

    setSavingCloud(true);
    setCloudError("");

    try {
      // Gravação robusta: não depende de upsert/onConflict nem da coluna
      // updated_at. Primeiro verifica se a conta já possui uma linha.
      const payload = {
        theme:
          (patch.theme as Theme | undefined) ??
          theme,
        transactions:
          (patch.transactions as Transaction[] | undefined) ??
          transactions,
        bills:
          (patch.bills as Bill[] | undefined) ??
          bills,
        cards:
          (patch.cards as Card[] | undefined) ??
          cards,
        purchases:
          (patch.purchases as CardPurchase[] | undefined) ??
          purchases,
        goals:
          (patch.goals as Goal[] | undefined) ??
          goals,
      };

      const { data: existing, error: findError } = await supabase
        .from("finance_user_data")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error } = await supabase
          .from("finance_user_data")
          .update(payload)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("finance_user_data")
          .insert({
            user_id: user.id,
            ...payload,
          });

        if (error) throw error;
      }
    } catch (error: any) {
      console.error(
        "Erro ao salvar dados:",
        error?.message ?? error,
        error?.details ?? "",
        error?.hint ?? ""
      );

      const message =
        error?.message ||
        error?.details ||
        "Não foi possível salvar a alteração.";

      setCloudError(`Não foi possível salvar: ${message}`);
    } finally {
      setSavingCloud(false);
    }
  }

  useEffect(() => {
    if (cloudReady) updateCloud({ theme });
  }, [theme, cloudReady]);

  useEffect(() => {
    if (cloudReady) updateCloud({ transactions });
  }, [transactions, cloudReady]);

  useEffect(() => {
    if (cloudReady) updateCloud({ bills });
  }, [bills, cloudReady]);

  useEffect(() => {
    if (cloudReady) updateCloud({ cards });
  }, [cards, cloudReady]);

  useEffect(() => {
    if (cloudReady) updateCloud({ purchases });
  }, [purchases, cloudReady]);

  useEffect(() => {
    if (cloudReady) updateCloud({ goals });
  }, [goals, cloudReady]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE.investments, JSON.stringify(investments));
    }
  }, [investments]);

  useEffect(() => {
    const defaultDate = dateForMonth(currentMonth);
    setTransactionForm((current) => ({ ...current, date: defaultDate }));
    setBillForm((current) => ({ ...current, dueDate: defaultDate }));
    setPurchaseForm((current) => ({ ...current, date: defaultDate }));
  }, [currentMonth]);

  const dark = theme === "dark";

  const availableMonths = useMemo(() => {
    const months = new Set<string>();

    transactions.forEach((item) => {
      const month = monthKeyFromDate(item.date);
      if (month) months.add(month);
    });

    bills.forEach((bill) => {
      const month = monthKeyFromDate(bill.dueDate);
      if (month) months.add(month);
    });

    if (currentMonth) months.add(currentMonth);

    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions, bills, currentMonth]);

  const viewTransactions = useMemo(
    () =>
      transactions.filter(
        (item) => !isMonthMarker(item) && monthKeyFromDate(item.date) === viewMonth
      ),
    [transactions, viewMonth]
  );

  const viewBills = useMemo(
    () => bills.filter((bill) => monthKeyFromDate(bill.dueDate) === viewMonth),
    [bills, viewMonth]
  );

  const income = useMemo(
    () =>
      viewTransactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0),
    [viewTransactions]
  );

  // Gastos são compostos pelos lançamentos de saída + contas que já foram pagas.
  // Conta pendente ainda não desconta do saldo; ao marcar como "Pago", ela entra
  // automaticamente nos Gastos, Saldo, Economia e gráficos.
  const paidBillsAsTransactions = useMemo(
    () =>
      viewBills
        .filter((bill) => bill.paid)
        .map((bill) => ({
          id: -bill.id,
          description: bill.description,
          category: bill.category,
          account: "Contas",
          date: bill.dueDate,
          amount: bill.amount,
          type: "expense" as const,
        })),
    [viewBills]
  );

  const dashboardTransactions = useMemo(
    () => [...viewTransactions, ...paidBillsAsTransactions],
    [viewTransactions, paidBillsAsTransactions]
  );

  const expenses = useMemo(
    () =>
      dashboardTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0),
    [dashboardTransactions]
  );

  const balance = income - expenses;

  // Economia é exatamente o resultado do mês: positiva ou negativa.
  const economy = balance;

  const pendingBills = useMemo(
    () =>
      viewBills
        .filter((bill) => !bill.paid)
        .reduce((sum, bill) => sum + bill.amount, 0),
    [viewBills]
  );

  const cardUsed = useMemo(
    () =>
      purchases.reduce(
        (sum, purchase) => sum + purchase.installmentValue,
        0
      ),
    [purchases]
  );

  const selectedCardData = cards.find((card) => card.id === selectedCard);

  const selectedCardPurchases = purchases.filter(
    (purchase) => purchase.cardId === selectedCard
  );

  const filteredTransactions = viewTransactions
    .filter((transaction) =>
      `${transaction.description} ${transaction.category} ${transaction.account}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  function navigate(nextPage: Page) {
    if (nextPage === page) {
      setMobileMenuOpen(false);
      return;
    }

    setPageHistory((current) => [...current, nextPage]);
    setPage(nextPage);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBackInApp() {
    setPageHistory((current) => {
      if (current.length <= 1) {
        setPage("dashboard");
        return ["dashboard"];
      }

      const nextHistory = current.slice(0, -1);
      setPage(nextHistory[nextHistory.length - 1]);
      setMobileMenuOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return nextHistory;
    });
  }

  function addTransaction(e: FormEvent) {
    e.preventDefault();

    const amount = Number(transactionForm.amount.replace(",", "."));

    if (!transactionForm.description || !amount) return;

    const transaction: Transaction = {
      id: Date.now(),
      description: transactionForm.description,
      category: transactionForm.category,
      account: transactionForm.account,
      date: transactionForm.date,
      amount,
      type: transactionForm.type,
    };

    setTransactions((current) => [transaction, ...current]);
    setModal(null);

    setTransactionForm({
      description: "",
      category: "Alimentação",
      account: "Nubank",
      date: "2026-08-19",
      amount: "",
      type: "expense",
    });
  }

  function addBill(e: FormEvent) {
    e.preventDefault();

    const amount = Number(billForm.amount.replace(",", "."));

    if (!billForm.description || !amount) return;

    setBills((current) => [
      {
        id: Date.now(),
        description: billForm.description,
        category: billForm.category,
        dueDate: billForm.dueDate,
        amount,
        paid: false,
      },
      ...current,
    ]);

    setModal(null);

    setBillForm({
      description: "",
      category: "Casa",
      dueDate: "2026-08-25",
      amount: "",
    });
  }

  function addPurchase(e: FormEvent) {
    e.preventDefault();

    const total = Number(purchaseForm.total.replace(",", "."));
    const installments = Math.max(
      1,
      Number(purchaseForm.installments)
    );

    if (!purchaseForm.description || !total) return;

    const installmentValue = total / installments;

    const purchase: CardPurchase = {
      id: Date.now(),
      cardId: Number(purchaseForm.cardId),
      description: purchaseForm.description,
      category: purchaseForm.category,
      date: purchaseForm.date,
      total,
      installments,
      installmentValue,
      currentInstallment: 1,
    };

    setPurchases((current) => [purchase, ...current]);

    setModal(null);

    setPurchaseForm({
      cardId: String(selectedCard),
      description: "",
      category: "Compras",
      date: "2026-08-19",
      total: "",
      installments: "1",
    });
  }

  function addGoal(e: FormEvent) {
    e.preventDefault();

    const target = Number(goalForm.target.replace(",", "."));
    const currentValue = Number(goalForm.current.replace(",", "."));

    if (!goalForm.name || !target) return;

    setGoals((current) => [
      {
        id: Date.now(),
        name: goalForm.name,
        target,
        current: currentValue || 0,
        deadline: goalForm.deadline,
        icon: goalForm.icon,
      },
      ...current,
    ]);

    setModal(null);

    setGoalForm({
      name: "",
      target: "",
      current: "",
      deadline: "2027-12-01",
      icon: "🎯",
    });
  }

  function startEditInvestment(investment: Investment) {
    setEditingInvestmentId(investment.id);
    setInvestmentForm({
      name: investment.name,
      invested: String(investment.invested),
      value: String(investment.value),
    });
    setModal("investment");
  }

  function saveInvestment(e: FormEvent) {
    e.preventDefault();

    const invested = Number(investmentForm.invested.replace(",", "."));
    const value = Number(investmentForm.value.replace(",", "."));

    if (!investmentForm.name.trim() || !Number.isFinite(invested) || invested <= 0 ||
        !Number.isFinite(value) || value < 0) {
      return;
    }

    if (editingInvestmentId !== null) {
      setInvestments((current) =>
        current.map((item) =>
          item.id === editingInvestmentId
            ? {
                ...item,
                name: investmentForm.name.trim(),
                invested,
                value,
              }
            : item
        )
      );
    } else {
      setInvestments((current) => [
        ...current,
        {
          id: Date.now(),
          name: investmentForm.name.trim(),
          invested,
          value,
        },
      ]);
    }

    setEditingInvestmentId(null);
    setModal(null);
    setInvestmentForm({ name: "", invested: "", value: "" });
  }

  function deleteInvestment(id: number) {
    setInvestments((current) => current.filter((item) => item.id !== id));
  }

  function startEditCard(card: Card) {
    setEditingCardId(card.id);
    setCardForm({
      name: card.name,
      brand: card.brand,
      last4: card.last4,
      limit: String(card.limit),
      closingDay: String(card.closingDay || 1),
      dueDay: String(card.dueDay || 1),
    });
    setModal("card");
  }

  function updateCard(e: FormEvent) {
    e.preventDefault();

    const limit = Number(cardForm.limit.replace(",", "."));
    const closingDay = Number(cardForm.closingDay);
    const dueDay = Number(cardForm.dueDay);

    if (
      editingCardId === null ||
      !cardForm.name ||
      !limit ||
      !Number.isInteger(closingDay) ||
      !Number.isInteger(dueDay) ||
      closingDay < 1 ||
      closingDay > 31 ||
      dueDay < 1 ||
      dueDay > 31
    ) {
      return;
    }

    setCards((current) =>
      current.map((card) =>
        card.id === editingCardId
          ? {
              ...card,
              name: cardForm.name,
              brand: cardForm.brand,
              last4: cardForm.last4,
              limit,
              closingDay,
              dueDay,
            }
          : card
      )
    );

    setEditingCardId(null);
    setModal(null);
    setCardForm({
      name: "",
      brand: "VISA",
      last4: "",
      limit: "",
      closingDay: "2",
      dueDay: "10",
    });
  }

  function addCard(e: FormEvent) {
    e.preventDefault();

    const limit = Number(cardForm.limit.replace(",", "."));
    const closingDay = Number(cardForm.closingDay);
    const dueDay = Number(cardForm.dueDay);

    if (
      !cardForm.name ||
      !limit ||
      !Number.isInteger(closingDay) ||
      !Number.isInteger(dueDay) ||
      closingDay < 1 ||
      closingDay > 31 ||
      dueDay < 1 ||
      dueDay > 31
    ) {
      return;
    }

    const card: Card = {
      id: Date.now(),
      name: cardForm.name,
      brand: cardForm.brand,
      last4: cardForm.last4,
      limit,
      closingDay,
      dueDay,
    };

    setCards((current) => [...current, card]);
    setModal(null);

    setCardForm({
      name: "",
      brand: "VISA",
      last4: "",
      limit: "",
      closingDay: "2",
      dueDay: "10",
    });
  }

  function toggleBill(id: number) {
    setBills((current) =>
      current.map((bill) =>
        bill.id === id ? { ...bill, paid: !bill.paid } : bill
      )
    );
  }

  function toggleCardInvoicePaid(cardId: number) {
    const month = currentCalendarMonthKey();
    const paidDate = new Date().toISOString().slice(0, 10);

    setCards((current) =>
      current.map((card) => {
        if (card.id !== cardId) return card;

        const alreadyPaid = card.invoicePaidMonth === month;

        return alreadyPaid
          ? {
              ...card,
              invoicePaidMonth: undefined,
              invoicePaidDate: undefined,
            }
          : {
              ...card,
              invoicePaidMonth: month,
              invoicePaidDate: paidDate,
            };
      })
    );
  }

  function deleteTransaction(id: number) {
    setTransactions((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function deleteBill(id: number) {
    setBills((current) => current.filter((item) => item.id !== id));
  }

  function deleteGoal(id: number) {
    setGoals((current) => current.filter((item) => item.id !== id));
  }

  function deletePurchase(id: number) {
    setPurchases((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function startEditGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name,
      target: String(goal.target),
      current: String(goal.current),
      deadline: goal.deadline,
      icon: goal.icon,
    });
    setModal("goal");
  }

  function updateGoal(e: FormEvent) {
    e.preventDefault();

    const target = Number(goalForm.target.replace(",", "."));
    const currentValue = Number(goalForm.current.replace(",", "."));

    if (
      editingGoalId === null ||
      !goalForm.name ||
      !target ||
      currentValue < 0
    ) {
      return;
    }

    setGoals((current) =>
      current.map((goal) =>
        goal.id === editingGoalId
          ? {
              ...goal,
              name: goalForm.name,
              target,
              current: Math.min(target, currentValue),
              deadline: goalForm.deadline,
              icon: goalForm.icon || "🎯",
            }
          : goal
      )
    );

    setEditingGoalId(null);
    setModal(null);
    setGoalForm({
      name: "",
      target: "",
      current: "",
      deadline: "2027-12-01",
      icon: "🎯",
    });
  }

  function addToGoal(goal: Goal) {
    setGoalAmountGoal(goal);
    setGoalAmount("");
  }

  function closeGoalAmountModal() {
    setGoalAmountGoal(null);
    setGoalAmount("");
  }

  function confirmAddToGoal(e: FormEvent) {
    e.preventDefault();

    if (!goalAmountGoal) return;

    const amount = Number(goalAmount.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) return;

    setGoals((current) =>
      current.map((item) =>
        item.id === goalAmountGoal.id
          ? {
              ...item,
              current: Math.min(item.target, item.current + amount),
            }
          : item
      )
    );

    closeGoalAmountModal();
  }

  function closeCurrentMonth() {
    const nextMonth = nextMonthKey(currentMonth);
    const currentLabel = monthLabel(currentMonth);
    const nextLabel = monthLabel(nextMonth);

    const confirmed = window.confirm(
      `Fechar ${currentLabel} e começar ${nextLabel} zerado?

` +
        `Os lançamentos de ${currentLabel} continuarão salvos no histórico.`
    );

    if (!confirmed) return;

    setTransactions((current) => {
      const alreadyStarted = current.some(
        (item) => isMonthMarker(item) && monthKeyFromDate(item.date) === nextMonth
      );

      if (alreadyStarted) return current;

      return [
        ...current,
        {
          id: Date.now(),
          description: MONTH_MARKER,
          category: "__system__",
          account: "__system__",
          date: `${nextMonth}-01`,
          amount: 0,
          type: "income",
          color: "month-marker",
        },
      ];
    });

    setCurrentMonth(nextMonth);
    setViewMonth(nextMonth);
    setSearch("");
    setPage("dashboard");
  }

  const pageTitle: Record<Page, string> = {
    dashboard: "Dashboard",
    transactions: "Lançamentos",
    bills: "Contas a pagar",
    cards: "Cartões",
    goals: "Metas",
    investments: "Investimentos",
    reports: "Relatórios",
    settings: "Configurações",
  };

  const displayName =
    user?.user_metadata?.nome ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuário";

  const userInitial = displayName.charAt(0).toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checkingAuth) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07111f",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Carregando seu financeiro...
      </main>
    );
  }

  return (
    <main className={dark ? "app dark" : "app"}>
      {mobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={mobileMenuOpen ? "sidebar mobile-sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-logo">
            <Icon name="wallet" size={20} />
          </div>

          <div>
            <strong>Meu Financeiro</strong>
            <span>Controle pessoal</span>
          </div>
        </div>

        <div className="menu-label">PRINCIPAL</div>

        <nav className="nav">
          <NavItem
            active={page === "dashboard"}
            icon="dashboard"
            label="Dashboard"
            onClick={() => navigate("dashboard")}
          />

          <NavItem
            active={page === "transactions"}
            icon="transactions"
            label="Lançamentos"
            onClick={() => navigate("transactions")}
          />

          <NavItem
            active={page === "bills"}
            icon="bills"
            label="Contas a pagar"
            onClick={() => navigate("bills")}
          />

          <NavItem
            active={page === "cards"}
            icon="card"
            label="Cartões"
            onClick={() => navigate("cards")}
          />

          <NavItem
            active={page === "goals"}
            icon="target"
            label="Metas"
            onClick={() => navigate("goals")}
          />

          <NavItem
            active={page === "investments"}
            icon="chart"
            label="Investimentos"
            onClick={() => navigate("investments")}
            hoverInfo={[
              "Patrimônio investido • R$ 8.450,00",
              "Rendimento • R$ 930,00",
              "Rentabilidade • 12,38%",
            ]}
          />

          <NavItem
            active={page === "reports"}
            icon="chart"
            label="Relatórios"
            onClick={() => navigate("reports")}
            hoverInfo={[
              `Entradas • ${money(income)}`,
              `Despesas • ${money(expenses)}`,
              `Resultado • ${money(income - expenses)}`,
            ]}
          />
        </nav>

        <div className="sidebar-bottom">
          <NavItem
            active={page === "settings"}
            icon="settings"
            label="Configurações"
            onClick={() => navigate("settings")}
          />

          <button
            type="button"
            className="profile"
            onClick={() => setShowAccountDetails((current) => !current)}
            aria-expanded={showAccountDetails}
            title="Abrir detalhes da conta"
          >
            <div className="avatar">{userInitial}</div>
            <div>
              <strong>{displayName}</strong>
              <span>{user?.email}</span>
            </div>
            <Icon name="more" size={17} />
          </button>

          {showAccountDetails && (
            <div className="account-popover">
              <div className="account-popover-title">Minha conta</div>

              <div className="account-detail">
                <span>Nome</span>
                <strong>{displayName}</strong>
              </div>

              <div className="account-detail">
                <span>E-mail</span>
                <strong>{user?.email || "—"}</strong>
              </div>

              <div className="account-status">
                <i />
                Conta ativa
              </div>

              <button
                type="button"
                className="account-close"
                onClick={() => setShowAccountDetails(false)}
              >
                Fechar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,.08)",
              background: "transparent",
              color: "#8fa1b5",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            Sair da conta
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand">
            {page !== "dashboard" && (
              <button
                type="button"
                className="mobile-back-button"
                onClick={goBackInApp}
                aria-label="Voltar"
              >
                <span aria-hidden="true">←</span>
              </button>
            )}

            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <Icon name="menu" size={20} />
            </button>

            <div className="brand-logo">
              <Icon name="wallet" size={18} />
            </div>
            <strong>Meu Financeiro</strong>
          </div>

          <div className="breadcrumb">
            <span>Visão geral</span>
            <b>/</b>
            <strong>{pageTitle[page]}</strong>
          </div>

          <div className="top-actions">
            <button
              className="theme-button"
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              title="Alternar tema"
            >
              <Icon name={dark ? "sun" : "moon"} size={18} />
            </button>

            <button className="notification">
              <Icon name="bell" size={18} />
              <i />
            </button>

            <button
              type="button"
              className="top-avatar top-avatar-button"
              onClick={() => setShowAccountDetails((current) => !current)}
              aria-expanded={showAccountDetails}
              aria-label="Abrir minha conta"
              title="Minha conta"
            >
              {userInitial}
            </button>
          </div>

          {showAccountDetails && (
            <div className="top-account-popover">
              <div className="account-popover-title">Minha conta</div>

              <div className="account-detail">
                <span>Nome</span>
                <strong>{displayName}</strong>
              </div>

              <div className="account-detail">
                <span>E-mail</span>
                <strong>{user?.email || "—"}</strong>
              </div>

              <div className="account-status">
                <i />
                Conta ativa
              </div>

              <button
                type="button"
                className="account-close"
                onClick={() => setShowAccountDetails(false)}
              >
                Fechar
              </button>
            </div>
          )}
        </header>

        <div className="page">
          {page === "dashboard" && (
            <Dashboard
              dark={dark}
              income={income}
              expenses={expenses}
              balance={balance}
              pendingBills={pendingBills}
              transactions={dashboardTransactions}
              bills={viewBills}
              cards={cards}
              purchases={purchases}
              goals={goals}
              userName={displayName}
              onNew={() => setModal("transaction")}
              onTransactions={() => navigate("transactions")}
              onBills={() => navigate("bills")}
              onCards={() => navigate("cards")}
              onGoals={() => navigate("goals")}
              currentMonth={currentMonth}
              selectedMonth={viewMonth}
              availableMonths={availableMonths}
              onMonthChange={setViewMonth}
            />
          )}

          {page === "transactions" && (
            <TransactionsPage
              dark={dark}
              transactions={filteredTransactions}
              search={search}
              setSearch={setSearch}
              onNew={() => setModal("transaction")}
              onDelete={deleteTransaction}
            />
          )}

          {page === "bills" && (
            <BillsPage
              dark={dark}
              bills={viewBills}
              onNew={() => setModal("bill")}
              onToggle={toggleBill}
              onDelete={deleteBill}
            />
          )}

          {page === "cards" && (
            <CardsPage
              dark={dark}
              cards={cards}
              purchases={purchases}
              selectedCard={selectedCard}
              setSelectedCard={setSelectedCard}
              onNewCard={() => setModal("card")}
              onNewPurchase={() => setModal("purchase")}
              onDeletePurchase={deletePurchase}
              onToggleInvoicePaid={toggleCardInvoicePaid}
              onEditCard={startEditCard}
            />
          )}

          {page === "goals" && (
            <GoalsPage
              dark={dark}
              goals={goals}
              onNew={() => {
                setEditingGoalId(null);
                setGoalForm({
                  name: "",
                  target: "",
                  current: "",
                  deadline: "2027-12-01",
                  icon: "🎯",
                });
                setModal("goal");
              }}
              onAdd={addToGoal}
              onEdit={startEditGoal}
              onDelete={deleteGoal}
            />
          )}

          {page === "investments" && (
            <InvestmentsPage
              dark={dark}
              investments={investments}
              onNew={() => {
                setEditingInvestmentId(null);
                setInvestmentForm({ name: "", invested: "", value: "" });
                setModal("investment");
              }}
              onEdit={startEditInvestment}
              onDelete={deleteInvestment}
            />
          )}

          {page === "reports" && (
            <ReportsPage
              dark={dark}
              income={income}
              expenses={expenses}
              transactions={viewTransactions}
            />
          )}

          {page === "settings" && (
            <SettingsPage
              dark={dark}
              theme={theme}
              setTheme={setTheme}
              currentMonth={currentMonth}
              onCloseMonth={closeCurrentMonth}
            />
          )}
        </div>
      </section>

      <nav className="mobile-bottom-nav" aria-label="Navegação principal no celular">
        <button
          type="button"
          className={page === "dashboard" ? "active" : ""}
          onClick={() => navigate("dashboard")}
        >
          <Icon name="dashboard" size={19} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          className={page === "transactions" ? "active" : ""}
          onClick={() => navigate("transactions")}
        >
          <Icon name="transactions" size={19} />
          <span>Lançamentos</span>
        </button>

        <button
          type="button"
          className={page === "bills" ? "active" : ""}
          onClick={() => navigate("bills")}
        >
          <Icon name="bills" size={19} />
          <span>Contas</span>
        </button>

        <button
          type="button"
          className={page === "cards" ? "active" : ""}
          onClick={() => navigate("cards")}
        >
          <Icon name="card" size={19} />
          <span>Cartões</span>
        </button>

        <button
          type="button"
          className={page === "goals" ? "active" : ""}
          onClick={() => navigate("goals")}
        >
          <Icon name="target" size={19} />
          <span>Metas</span>
        </button>
      </nav>

      {modal === "transaction" && (
        <Modal
          title="Novo lançamento"
          onClose={() => setModal(null)}
          dark={dark}
        >
          <form onSubmit={addTransaction}>
            <div className="type-switch">
              <button
                type="button"
                className={
                  transactionForm.type === "expense"
                    ? "active expense"
                    : ""
                }
                onClick={() =>
                  setTransactionForm((current) => ({
                    ...current,
                    type: "expense",
                  }))
                }
              >
                <Icon name="arrowDown" size={16} />
                Despesa
              </button>

              <button
                type="button"
                className={
                  transactionForm.type === "income"
                    ? "active income"
                    : ""
                }
                onClick={() =>
                  setTransactionForm((current) => ({
                    ...current,
                    type: "income",
                  }))
                }
              >
                <Icon name="arrowUp" size={16} />
                Entrada
              </button>
            </div>

            <div className="form-grid">
              <Field
                label="Descrição"
                value={transactionForm.description}
                placeholder="Ex.: Mercado"
                onChange={(value) =>
                  setTransactionForm((current) => ({
                    ...current,
                    description: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Valor"
                value={transactionForm.amount}
                placeholder="0,00"
                type="number"
                onChange={(value) =>
                  setTransactionForm((current) => ({
                    ...current,
                    amount: value,
                  }))
                }
                dark={dark}
              />

              <SelectField
                label="Categoria"
                value={transactionForm.category}
                options={[
                  "Alimentação",
                  "Casa",
                  "Transporte",
                  "Lazer",
                  "Compras",
                  "Salário",
                  "Investimentos",
                  "Outros",
                ]}
                onChange={(value) =>
                  setTransactionForm((current) => ({
                    ...current,
                    category: value,
                  }))
                }
                dark={dark}
              />

              <SelectField
                label="Conta"
                value={transactionForm.account}
                options={["Nubank", "Inter", "Dinheiro", "Outros"]}
                onChange={(value) =>
                  setTransactionForm((current) => ({
                    ...current,
                    account: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Data"
                value={transactionForm.date}
                type="date"
                onChange={(value) =>
                  setTransactionForm((current) => ({
                    ...current,
                    date: value,
                  }))
                }
                dark={dark}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>

              <button type="submit" className="btn primary">
                <Icon name="check" size={17} />
                Salvar lançamento
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "bill" && (
        <Modal
          title="Nova conta"
          onClose={() => setModal(null)}
          dark={dark}
        >
          <form onSubmit={addBill}>
            <div className="form-grid">
              <Field
                label="Descrição"
                value={billForm.description}
                placeholder="Ex.: Luz"
                onChange={(value) =>
                  setBillForm((current) => ({
                    ...current,
                    description: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Valor"
                value={billForm.amount}
                placeholder="0,00"
                type="number"
                onChange={(value) =>
                  setBillForm((current) => ({
                    ...current,
                    amount: value,
                  }))
                }
                dark={dark}
              />

              <SelectField
                label="Categoria"
                value={billForm.category}
                options={["Casa", "Assinaturas", "Educação", "Outros"]}
                onChange={(value) =>
                  setBillForm((current) => ({
                    ...current,
                    category: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Vencimento"
                value={billForm.dueDate}
                type="date"
                onChange={(value) =>
                  setBillForm((current) => ({
                    ...current,
                    dueDate: value,
                  }))
                }
                dark={dark}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>

              <button className="btn primary">
                <Icon name="check" size={17} />
                Criar conta
              </button>
            </div>
          </form>
        </Modal>
      )}{modal === "purchase" && (
        <Modal
          title="Nova compra no cartão"
          onClose={() => setModal(null)}
          dark={dark}
        >
          <form onSubmit={addPurchase}>
            <div className="form-grid">
              <SelectField
                label="Cartão"
                value={purchaseForm.cardId}
                options={cards.map((card) => String(card.id))}
                labels={cards.map(
                  (card) => `${card.name} •••• ${card.last4}`
                )}
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    cardId: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Descrição"
                value={purchaseForm.description}
                placeholder="Ex.: Tênis"
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    description: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Valor total"
                value={purchaseForm.total}
                placeholder="0,00"
                type="number"
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    total: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Parcelas"
                value={purchaseForm.installments}
                placeholder="1"
                type="number"
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    installments: value,
                  }))
                }
                dark={dark}
              />

              <SelectField
                label="Categoria"
                value={purchaseForm.category}
                options={[
                  "Alimentação",
                  "Compras",
                  "Transporte",
                  "Lazer",
                  "Casa",
                  "Outros",
                ]}
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    category: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Data"
                value={purchaseForm.date}
                type="date"
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    date: value,
                  }))
                }
                dark={dark}
              />
            </div>

            {Number(purchaseForm.total) > 0 &&
              Number(purchaseForm.installments) > 1 && (
                <div className="installment-preview">
                  <span>Valor de cada parcela</span>
                  <strong>
                    {money(
                      Number(purchaseForm.total) /
                        Number(purchaseForm.installments)
                    )}
                  </strong>
                </div>
              )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>

              <button type="submit" className="btn primary">
                <Icon name="check" size={17} />
                Adicionar compra
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "investment" && (
        <Modal
          title={
            editingInvestmentId !== null
              ? "Editar investimento"
              : "Novo investimento"
          }
          onClose={() => {
            setEditingInvestmentId(null);
            setModal(null);
          }}
          dark={dark}
        >
          <form onSubmit={saveInvestment}>
            <div className="form-grid">
              <Field
                label="Investimento"
                value={investmentForm.name}
                placeholder="Ex.: Bitcoin"
                onChange={(value) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Valor investido"
                value={investmentForm.invested}
                placeholder="2500"
                type="number"
                onChange={(value) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    invested: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Valor atual"
                value={investmentForm.value}
                placeholder="2800"
                type="number"
                onChange={(value) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    value,
                  }))
                }
                dark={dark}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setEditingInvestmentId(null);
                  setModal(null);
                }}
              >
                Cancelar
              </button>

              <button className="btn primary">
                <Icon name="check" size={17} />
                {editingInvestmentId !== null
                  ? "Salvar alterações"
                  : "Adicionar investimento"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "goal" && (
        <Modal
          title={editingGoalId !== null ? "Editar meta financeira" : "Nova meta financeira"}
          onClose={() => {
            setEditingGoalId(null);
            setModal(null);
          }}
          dark={dark}
        >
          <form onSubmit={editingGoalId !== null ? updateGoal : addGoal}>
            <div className="form-grid">
              <Field
                label="Nome da meta"
                value={goalForm.name}
                placeholder="Ex.: Comprar um carro"
                onChange={(value) =>
                  setGoalForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Objetivo"
                value={goalForm.target}
                placeholder="30000"
                type="number"
                onChange={(value) =>
                  setGoalForm((current) => ({
                    ...current,
                    target: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Já tenho"
                value={goalForm.current}
                placeholder="0"
                type="number"
                onChange={(value) =>
                  setGoalForm((current) => ({
                    ...current,
                    current: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Prazo"
                value={goalForm.deadline}
                type="date"
                onChange={(value) =>
                  setGoalForm((current) => ({
                    ...current,
                    deadline: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Ícone"
                value={goalForm.icon}
                placeholder="🚗"
                onChange={(value) =>
                  setGoalForm((current) => ({
                    ...current,
                    icon: value,
                  }))
                }
                dark={dark}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>

              <button className="btn primary">
                <Icon name="check" size={17} />
                {editingGoalId !== null ? "Salvar alterações" : "Criar meta"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {goalAmountGoal && (
        <Modal
          title={`Adicionar dinheiro • ${goalAmountGoal.name}`}
          onClose={closeGoalAmountModal}
          dark={dark}
        >
          <form onSubmit={confirmAddToGoal}>
            <div className="goal-amount-summary">
              <div>
                <span>Valor atual</span>
                <strong>{money(goalAmountGoal.current)}</strong>
              </div>
              <div>
                <span>Objetivo</span>
                <strong>{money(goalAmountGoal.target)}</strong>
              </div>
              <div>
                <span>Falta</span>
                <strong>
                  {money(Math.max(0, goalAmountGoal.target - goalAmountGoal.current))}
                </strong>
              </div>
            </div>

            <Field
              label="Quanto deseja adicionar?"
              value={goalAmount}
              placeholder="Ex.: 500,00"
              type="number"
              onChange={setGoalAmount}
              dark={dark}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={closeGoalAmountModal}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn primary"
                disabled={
                  !Number.isFinite(Number(goalAmount.replace(",", "."))) ||
                  Number(goalAmount.replace(",", ".")) <= 0
                }
              >
                <Icon name="check" size={17} />
                Adicionar à meta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "card" && (
        <Modal
          title={editingCardId !== null ? "Editar cartão" : "Adicionar cartão"}
          onClose={() => {
            setEditingCardId(null);
            setModal(null);
          }}
          dark={dark}
        >
          <form onSubmit={editingCardId !== null ? updateCard : addCard}>
            <div className="form-grid">
              <Field
                label="Nome do cartão"
                value={cardForm.name}
                placeholder="Ex.: Nubank"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
                dark={dark}
              />

              <SelectField
                label="Bandeira"
                value={cardForm.brand}
                options={["VISA", "MASTERCARD", "ELO", "AMEX"]}
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    brand: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Últimos 4 dígitos"
                value={cardForm.last4}
                placeholder="4281"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    last4: value.slice(0, 4),
                  }))
                }
                dark={dark}
              />

              <Field
                label="Limite"
                value={cardForm.limit}
                placeholder="3000"
                type="number"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    limit: value,
                  }))
                }
                dark={dark}
              />

              <div className="card-day-fields">
                <span className="card-day-help">
                  Informe os dias do seu cartão. A fatura só fica amarela como pendente a partir do vencimento; antes disso fica apenas como "a vencer".
                </span>
              </div>

              <Field
                label="Dia de fechamento"
                value={cardForm.closingDay}
                placeholder="Ex.: 2"
                type="number"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    closingDay: value.replace(/\\D/g, "").slice(0, 2),
                  }))
                }
                dark={dark}
              />

              <Field
                label="Dia de vencimento"
                value={cardForm.dueDay}
                placeholder="Ex.: 10"
                type="number"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    dueDay: value.replace(/\\D/g, "").slice(0, 2),
                  }))
                }
                dark={dark}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>

              <button className="btn primary">
                <Icon name="check" size={17} />
                {editingCardId !== null ? "Salvar alterações" : "Adicionar cartão"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function NavItem({
  icon,
  label,
  active,
  onClick,
  hoverInfo,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  hoverInfo?: string[];
}) {
  return (
    <div className="nav-item-wrap">
      <button
        className={active ? "nav-item active" : "nav-item"}
        onClick={onClick}
      >
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </button>

      {hoverInfo && hoverInfo.length > 0 && (
        <div className="nav-hover-info" role="tooltip">
          <strong>{label}</strong>
          {hoverInfo.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  labels,
  onChange,
  dark,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: string[];
  onChange: (value: string) => void;
  dark: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <select
        className={dark ? "input input-dark" : "input"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option, index) => (
          <option key={option} value={option}>
            {labels?.[index] || option}
          </option>
        ))}
      </select>
    </label>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  dark,
  income,
  expenses,
  balance,
  pendingBills,
  transactions,
  bills,
  cards,
  purchases,
  goals,
  userName,
  onNew,
  onTransactions,
  onBills,
  onCards,
  onGoals,
  currentMonth,
  selectedMonth,
  availableMonths,
  onMonthChange,
}: {
  dark: boolean;
  income: number;
  expenses: number;
  balance: number;
  pendingBills: number;
  transactions: Transaction[];
  bills: Bill[];
  cards: Card[];
  purchases: CardPurchase[];
  goals: Goal[];
  userName: string;
  onNew: () => void;
  onTransactions: () => void;
  onBills: () => void;
  onCards: () => void;
  onGoals: () => void;
  currentMonth: string;
  selectedMonth: string;
  availableMonths: string[];
  onMonthChange: (month: string) => void;
}) {
  const economy =
    income > 0
      ? Math.max(0, Math.round(((income - expenses) / income) * 100))
      : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VISÃO GERAL / {monthLabel(selectedMonth).toUpperCase()}</p>
          <h1>Olá, {userName}! 👋</h1>
          <p>Aqui está o resumo das suas finanças.</p>
        </div>

        <div className="heading-actions">
          <select
            className="period period-select"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
            aria-label="Selecionar mês"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}{month === currentMonth ? " • atual" : ""}
              </option>
            ))}
          </select>

          <button className="btn primary" onClick={onNew}>
            <Icon name="plus" size={17} />
            Nova movimentação
          </button>
        </div>
      </div>

      <div className="stats-grid dashboard-premium-stats">
        <DashboardPremiumStat
          title="Entradas"
          value={money(income)}
          subtitle="Receitas deste mês"
          icon="arrowUp"
          type="green"
          trend="+18,6%"
          points={[28, 35, 31, 44, 39, 51, 47, 62]}
        />

        <DashboardPremiumStat
          title="Gastos"
          value={money(expenses)}
          subtitle="Despesas deste mês"
          icon="arrowDown"
          type="red"
          trend="-6,2%"
          points={[34, 28, 39, 32, 47, 41, 54, 50]}
        />

        <DashboardPremiumStat
          title="Saldo"
          value={money(balance)}
          subtitle="Resultado do mês"
          icon="wallet"
          type="blue"
          trend={`${balance >= 0 ? "+" : ""}${economy}%`}
          points={[22, 29, 26, 38, 34, 45, 41, 55]}
        />

        <DashboardPremiumStat
          title="Economia"
          value={money(economy)}
          subtitle="Você economizou"
          icon="card"
          type={economy < 0 ? "red" : "green"}
          trend={`${income > 0 ? ((economy / income) * 100).toFixed(1) : "0.0"}%`}
          points={[20, 25, 24, 33, 31, 40, 38, 48]}
          ring
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelHeader
            title="Fluxo financeiro"
            subtitle="Entradas x gastos"
            action="Este mês"
          />

          <div className="legend">
            <span>
              <i className="dot green" />
              Entradas
            </span>

            <span>
              <i className="dot red" />
              Gastos
            </span>
          </div>

          <MiniChart
            dark={dark}
            interactive
            transactions={transactions}
            month={selectedMonth}
          />
        </section>

        <section className="panel category-panel">
          <PanelHeader
            title="Gastos por categoria"
            subtitle="Onde seu dinheiro está indo"
          />

          {(() => {
            const categoryConfig = [
              ["Casa", "green"],
              ["Alimentação", "blue"],
              ["Transporte", "orange"],
              ["Lazer", "purple"],
              ["Assinaturas", "pink"],
              ["Outros", "gray"],
            ] as const;

            const categoryTotals = categoryConfig
              .map(([label, color]) => ({
                label,
                color,
                value: transactions
                  .filter((item) => item.type === "expense")
                  .filter((item) => item.category === label)
                  .reduce((sum, item) => sum + item.amount, 0),
              }))
              .filter((item) => item.value > 0);

            const categoryTotal = categoryTotals.reduce(
              (sum, item) => sum + item.value,
              0
            );

            return (
              <div className="category-content">
                <DonutChart total={categoryTotal} />

                <div className="category-list">
                  {categoryTotals.map((item) => (
                    <CategoryLine
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      percent={
                        categoryTotal > 0
                          ? Math.round((item.value / categoryTotal) * 100)
                          : 0
                      }
                      color={item.color}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          <button className="text-button" onClick={onTransactions}>
            Ver todas as categorias →
          </button>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel">
          <PanelHeader
            title="Últimos lançamentos"
            subtitle="Movimentações recentes"
            action="Ver todos"
            onAction={onTransactions}
          />

          <div className="transaction-list">
            {transactions.slice(0, 5).map((item) => (
              <TransactionRow
                key={item.id}
                item={item}
                dark={dark}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelHeader
            title="Próximas contas"
            subtitle="Contas a vencer"
            action="Ver todas"
            onAction={onBills}
          />

          <div className="bill-list">
            {bills.filter((bill) => !bill.paid).slice(0, 4).map((bill) => (
              <div className="bill-row" key={bill.id}>
                <div className="bill-icon">
                  <Icon name="bills" size={17} />
                </div>

                <div className="bill-info">
                  <strong>{bill.description}</strong>
                  <span>
                    Vencimento {dateBR(bill.dueDate)}
                  </span>
                </div>

                <div className="bill-value">
                  <strong>{money(bill.amount)}</strong>

                  <span className={bill.paid ? "paid" : "pending"}>
                    {bill.paid ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="panel-total">
            <span>Total pendente</span>
            <strong>{money(pendingBills)}</strong>
          </div>
        </section>

        <section className="panel">
          <PanelHeader
            title="Metas"
            subtitle="Acompanhe seus objetivos"
            action="Ver todas"
            onAction={onGoals}
          />

          <div className="goal-list">
            {goals.slice(0, 3).map((goal) => {
              const progress = Math.min(
                100,
                Math.round((goal.current / goal.target) * 100)
              );

              return (
                <div className="goal-mini" key={goal.id}>
                  <div className="goal-mini-top">
                    <span className="goal-name">
                      {goal.icon} {goal.name}
                    </span>
                    <strong>{progress}%</strong>
                  </div>

                  <div className="progress">
                    <i style={{ width: `${progress}%` }} />
                  </div>

                  <div className="goal-mini-bottom">
                    <span>{money(goal.current)}</span>
                    <span>{money(goal.target)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn primary full" onClick={onNew}>
            <Icon name="plus" size={17} />
            Nova movimentação
          </button>
        </section>
      </div>
    </>
  );
}


function DashboardPremiumStat({
  title,
  value,
  subtitle,
  icon,
  type,
  trend,
  points,
  ring = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  type: "green" | "red" | "blue";
  trend: string;
  points: number[];
  ring?: boolean;
}) {
  const line = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 94 + 3;
      const y = 28 - (point / 70) * 23;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rawRingValue = Number.parseFloat(trend) || 0;
  const ringValue = Math.max(0, Math.min(100, Math.abs(rawRingValue)));
  const ringColor = type === "red" ? "#ff6b6b" : "#57ef92";

  return (
    <div className={`dashboard-premium-stat ${type}${ring ? " economy-stat" : ""}`}>
      <div className="dashboard-premium-stat-top">
        <div className={`dashboard-premium-icon ${type}`}>
          <Icon name={icon} size={18} />
        </div>

        <span className="dashboard-premium-stat-title">{title}</span>

        {ring && (
          <div
            className="dashboard-premium-ring"
            style={{
              background: `radial-gradient(circle at center, var(--panel) 61%, transparent 63%), conic-gradient(${ringColor} 0 ${ringValue}%, rgba(87,239,146,.12) ${ringValue}% 100%)`,
            }}
            aria-label={`${rawRingValue.toFixed(1)}% da receita de resultado do mês`}
          >
            <span>{ringValue.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <strong className="dashboard-premium-value">{value}</strong>

      <div className="dashboard-premium-bottom">
        <div>
          <span className="dashboard-premium-subtitle">
            {ring && rawRingValue < 0 ? "Você ficou no negativo" : subtitle}
          </span>
          {ring ? (
            <span className="dashboard-premium-trend economy-saved-label">
              da sua receita
            </span>
          ) : (
            <span className="dashboard-premium-trend">
              {trend} <small>vs mês anterior</small>
            </span>
          )}
        </div>

        <svg
          className="dashboard-premium-spark"
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`spark-${type}-${ring ? "economy" : "normal"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity=".24" />
              <stop offset="100%" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polyline
            points={`3,30 ${line} 97,30`}
            fill={`url(#spark-${type}-${ring ? "economy" : "normal"})`}
            stroke="none"
          />

          <polyline
            points={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {ring && (
        <button
          type="button"
          className="economy-arrow"
          aria-label="Ver detalhes da economia"
          onClick={() => {}}
        >
          ›
        </button>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  type,
  dark,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  type: string;
  dark: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>

        <div className={`stat-icon ${type}`}>
          <Icon name={icon} size={17} />
        </div>
      </div>

      <strong className={`stat-value ${type}`}>{value}</strong>

      <span className="stat-subtitle">{subtitle}</span>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {action && (
        <button
          className="panel-action"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function CategoryLine({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="category-line">
      <div>
        <span className={`dot ${color}`} />
        <span>{label}</span>
      </div>

      <strong>{money(value)}</strong>

      <small>{percent}%</small>
    </div>
  );
}

function TransactionRow({
  item,
  dark,
}: {
  item: Transaction;
  dark: boolean;
}) {
  const icon =
    item.category === "Alimentação"
      ? "🛒"
      : item.category === "Casa"
      ? "🏠"
      : item.category === "Transporte"
      ? "🚗"
      : item.type === "income"
      ? "↓"
      : "•";

  return (
    <div className="transaction-row">
      <div
        className={
          item.type === "income"
            ? "transaction-icon income"
            : "transaction-icon expense"
        }
      >
        {icon}
      </div>

      <div className="transaction-info">
        <strong>{item.description}</strong>
        <span>{item.category}</span>
      </div>

      <div className="transaction-date">
        {dateBR(item.date)}
      </div>

      <strong
        className={
          item.type === "income"
            ? "amount income-text"
            : "amount expense-text"
        }
      >
        {item.type === "income" ? "+" : "-"}
        {money(item.amount)}
      </strong>
    </div>
  );
}

/* =========================================================
   LANÇAMENTOS
========================================================= */

function TransactionsPage({
  dark,
  transactions,
  search,
  setSearch,
  onNew,
  onDelete,
}: {
  dark: boolean;
  transactions: Transaction[];
  search: string;
  setSearch: (value: string) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCEIRO</p>
          <h1>Lançamentos</h1>
          <p>Controle todas as suas entradas e despesas.</p>
        </div>

        <button className="btn primary" onClick={onNew}>
          <Icon name="plus" size={17} />
          Novo lançamento
        </button>
      </div>

      <section className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Icon name="search" size={17} />
            <input
              value={search}
              placeholder="Buscar lançamento..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="filter-button">Todos ▾</button>
          <button className="filter-button">Este mês ▾</button>
        </div>

        <div className="table">
          <div className="table-head">
            <span>DESCRIÇÃO</span>
            <span>CATEGORIA</span>
            <span>CONTA</span>
            <span>DATA</span>
            <span>VALOR</span>
            <span />
          </div>

          {transactions.map((item) => (
            <div className="table-row" key={item.id}>
              <div className="table-description">
                <div
                  className={
                    item.type === "income"
                      ? "table-icon income"
                      : "table-icon expense"
                  }
                >
                  <Icon
                    name={
                      item.type === "income"
                        ? "arrowDown"
                        : "arrowUp"
                    }
                    size={16}
                  />
                </div>

                <strong>{item.description}</strong>
              </div>

              <span>{item.category}</span>
              <span>{item.account}</span>
              <span>{dateBR(item.date)}</span>

              <strong
                className={
                  item.type === "income"
                    ? "income-text"
                    : "expense-text"
                }
              >
                {item.type === "income" ? "+" : "-"}
                {money(item.amount)}
              </strong>

              <button
                className="delete-button"
                onClick={() => onDelete(item.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}

          {!transactions.length && (
            <div className="empty">
              Nenhum lançamento encontrado.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* =========================================================
   CONTAS
========================================================= */

function BillsPage({
  dark,
  bills,
  onNew,
  onToggle,
  onDelete,
}: {
  dark: boolean;
  bills: Bill[];
  onNew: () => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const paid = bills
    .filter((bill) => bill.paid)
    .reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONTROLE</p>
          <h1>Contas a pagar</h1>
          <p>Tenha controle dos próximos vencimentos.</p>
        </div>

        <button className="btn primary" onClick={onNew}>
          <Icon name="plus" size={17} />
          Nova conta
        </button>
      </div>

      <div className="stats-grid three">
        <StatCard
          title="Total do mês"
          value={money(total)}
          subtitle="Todas as contas"
          icon="bills"
          type="blue"
          dark={dark}
        />

        <StatCard
          title="Pago"
          value={money(paid)}
          subtitle="Contas já quitadas"
          icon="check"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Pendente"
          value={money(total - paid)}
          subtitle="Ainda para pagar"
          icon="arrowUp"
          type="red"
          dark={dark}
        />
      </div>

      <section className="panel">
        <PanelHeader
          title="Próximas contas"
          subtitle="Acompanhe seus vencimentos"
        />

        <div className="bill-page-list">
          {bills.map((bill) => (
            <div className="bill-card" key={bill.id}>
              <div className="bill-date">
                <strong>
                  {bill.dueDate.split("-")[2]}
                </strong>
                <span>
                  {new Date(
                    `${bill.dueDate}T12:00:00`
                  ).toLocaleDateString("pt-BR", {
                    month: "short",
                  })}
                </span>
              </div>

              <div className="bill-main">
                <strong>{bill.description}</strong>
                <span>{bill.category}</span>
              </div>

              <div className="bill-main-value">
                <strong>{money(bill.amount)}</strong>

                <span
                  className={
                    bill.paid ? "status paid" : "status pending"
                  }
                >
                  {bill.paid ? "Pago" : "Pendente"}
                </span>
              </div>

              <button
                className="check-button"
                onClick={() => onToggle(bill.id)}
              >
                <Icon name="check" size={17} />
              </button>

              <button
                className="delete-button"
                onClick={() => onDelete(bill.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* =========================================================
   CARTÕES
========================================================= */

function CardsPage({
  dark,
  cards,
  purchases,
  selectedCard,
  setSelectedCard,
  onNewCard,
  onNewPurchase,
  onDeletePurchase,
  onToggleInvoicePaid,
  onEditCard,
}: {
  dark: boolean;
  cards: Card[];
  purchases: CardPurchase[];
  selectedCard: number;
  setSelectedCard: (id: number) => void;
  onNewCard: () => void;
  onNewPurchase: () => void;
  onDeletePurchase: (id: number) => void;
  onToggleInvoicePaid: (cardId: number) => void;
  onEditCard: (card: Card) => void;
}) {
  const card = cards.find((item) => item.id === selectedCard);
  const invoiceMonth = currentCalendarMonthKey();
  const invoiceStatus = card
    ? invoiceStatusForCard(card)
    : ("upcoming" as const);
  const invoicePaid = invoiceStatus === "paid";
  const invoicePending = invoiceStatus === "pending";

  const cardPurchases = purchases.filter(
    (purchase) => purchase.cardId === selectedCard
  );

  const used = cardPurchases.reduce(
    (sum, purchase) => sum + purchase.installmentValue,
    0
  );

  const available = Math.max(
    0,
    (card?.limit || 0) - used
  );

  const usage = card?.limit
    ? Math.min(100, (used / card.limit) * 100)
    : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CRÉDITO</p>
          <h1>Cartões</h1>
          <p>Controle seus cartões, faturas e parcelas.</p>
        </div>

        <div className="heading-actions">
          <button className="btn secondary" onClick={onNewCard}>
            <Icon name="plus" size={17} />
            Novo cartão
          </button>

          <button className="btn primary" onClick={onNewPurchase}>
            <Icon name="plus" size={17} />
            Nova compra
          </button>
        </div>
      </div>

      <div className="cards-layout">
        <section className="panel">
          <PanelHeader
            title="Meus cartões"
            subtitle="Selecione um cartão para visualizar"
          />

          <div className="credit-card-list">
            {cards.map((item) => {
              const itemUsed = purchases
                .filter((purchase) => purchase.cardId === item.id)
                .reduce(
                  (sum, purchase) =>
                    sum + purchase.installmentValue,
                  0
                );

              const itemPercent =
                item.limit > 0
                  ? Math.min(
                      100,
                      (itemUsed / item.limit) * 100
                    )
                  : 0;

              return (
                <div
                  key={item.id}
                  className={
                    selectedCard === item.id
                      ? "credit-card selected"
                      : "credit-card"
                  }
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCard(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCard(item.id);
                    }
                  }}
                >
                  <div className="credit-card-top">
                    <span>{item.name}</span>
                    <strong>{item.brand}</strong>
                  </div>

                  <div className="card-edit-row">
                    <button
                      type="button"
                      className="card-edit-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditCard(item);
                      }}
                      aria-label={`Editar ${item.name}`}
                      title="Editar cartão"
                    >
                      <Icon name="edit" size={15} />
                      Editar
                    </button>
                  </div>

                  <div className="card-number">
                    •••• •••• •••• {item.last4}
                  </div>

                  <div className="credit-card-bottom">
                    <span>
                      Limite {money(item.limit)}
                    </span>
                    <span>•••</span>
                  </div>

                  <div className="card-progress">
                    <i style={{ width: `${itemPercent}%` }} />
                  </div>

                  <div className="card-limit-row">
                    <span>
                      Usado {money(itemUsed)}
                    </span>
                    <span>
                      Disponível{" "}
                      {money(
                        Math.max(0, item.limit - itemUsed)
                      )}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        </section>

        <section className="panel invoice-panel">
          <div className="invoice-header">
            <div>
              <p className="eyebrow">FATURA ATUAL</p>
              <h2>
                {card?.name || "Cartão"}{" "}
                <span>•••• {card?.last4}</span>
              </h2>
            </div>

            <div className="invoice-value">
              <span>Valor da fatura</span>
              <strong>{money(used)}</strong>
            </div>
          </div>

          <div
            className={`invoice-status ${
              invoicePaid ? "paid" : invoicePending ? "pending" : "upcoming"
            }`}
          >
            <div>
              <span>Status da fatura</span>
              <strong>
                {invoicePaid
                  ? "✓ Fatura paga"
                  : invoicePending
                    ? "Fatura pendente"
                    : "Fatura a vencer"}
              </strong>

              {invoicePaid && card?.invoicePaidDate && (
                <small>Pago em {dateBR(card.invoicePaidDate)}</small>
              )}

              {!invoicePaid && !invoicePending && (
                <small>
                  Fica pendente a partir do dia {card?.dueDay}.
                </small>
              )}
            </div>

            <button
              type="button"
              className={`invoice-paid-button ${
                invoicePaid ? "paid-button" : ""
              }`}
              onClick={() => card && onToggleInvoicePaid(card.id)}
            >
              <Icon name="check" size={16} />
              {invoicePaid ? "Marcar como pendente" : "Marcar como paga"}
            </button>
          </div>

          <div className="invoice-progress">
            <div className="invoice-progress-top">
              <span>
                {money(used)} utilizados
              </span>

              <span>
                Limite {money(card?.limit || 0)}
              </span>
            </div>

            <div className="progress large">
              <i style={{ width: `${usage}%` }} />
            </div>

            <div className="invoice-progress-bottom">
              <span>
                Disponível: <strong>{money(available)}</strong>
              </span>

              <span>
                Fecha dia {card?.closingDay}
              </span>
            </div>
          </div>

          <div className="invoice-info-grid">
            <div>
              <span>Fechamento</span>
              <strong>Dia {card?.closingDay}</strong>
            </div>

            <div>
              <span>Vencimento</span>
              <strong>Dia {card?.dueDay}</strong>
            </div>

            <div>
              <span>Compras</span>
              <strong>{cardPurchases.length}</strong>
            </div>
          </div>

          <PanelHeader
            title="Compras da fatura"
            subtitle="Parcelamentos e compras recentes"
          />

          <div className="purchase-list">
            {cardPurchases.map((purchase) => (
              <div className="purchase-row" key={purchase.id}>
                <div className="purchase-icon">
                  <Icon name="card" size={17} />
                </div>

                <div className="purchase-info">
                  <strong>{purchase.description}</strong>

                  <span>
                    {purchase.category} •{" "}
                    {purchase.installments > 1
                      ? `${purchase.currentInstallment}/${purchase.installments}`
                      : "À vista"}
                  </span>
                </div>

                <div className="purchase-value">
                  <strong>
                    {money(purchase.installmentValue)}
                  </strong>

                  {purchase.installments > 1 && (
                    <span>
                      total {money(purchase.total)}
                    </span>
                  )}
                </div>

                <button
                  className="delete-button"
                  onClick={() =>
                    onDeletePurchase(purchase.id)
                  }
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}

            {!cardPurchases.length && (
              <div className="empty">
                Nenhuma compra neste cartão.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/* =========================================================
   METAS
========================================================= */

function GoalsPage({
  dark,
  goals,
  onNew,
  onAdd,
  onEdit,
  onDelete,
}: {
  dark: boolean;
  goals: Goal[];
  onNew: () => void;
  onAdd: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLANEJAMENTO</p>
          <h1>Metas financeiras</h1>
          <p>Transforme seus objetivos em planos.</p>
        </div>

        <button className="btn primary" onClick={onNew}>
          <Icon name="plus" size={17} />
          Nova meta
        </button>
      </div>

      <div className="goal-grid">
        {goals.map((goal) => {
          const progress = Math.min(
            100,
            Math.round((goal.current / goal.target) * 100)
          );

          const remaining = Math.max(
            0,
            goal.target - goal.current
          );

          return (
            <section className="panel goal-card" key={goal.id}>
              <div className="goal-card-top">
                <div className="goal-big-icon">
                  {goal.icon}
                </div>

                <div className="goal-card-actions">
                  <button
                    className="goal-edit-button"
                    onClick={() => onEdit(goal)}
                    aria-label={`Editar meta ${goal.name}`}
                    title="Editar meta"
                  >
                    <Icon name="edit" size={15} />
                  </button>

                  <button
                    className="delete-button"
                    onClick={() => onDelete(goal.id)}
                    aria-label={`Excluir meta ${goal.name}`}
                    title="Excluir meta"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              <h2>{goal.name}</h2>

              <div className="goal-progress-number">
                <strong>{progress}%</strong>
                <span>concluído</span>
              </div>

              <div className="progress large">
                <i style={{ width: `${progress}%` }} />
              </div>

              <div className="goal-values">
                <div>
                  <span>Atual</span>
                  <strong>{money(goal.current)}</strong>
                </div>

                <div>
                  <span>Objetivo</span>
                  <strong>{money(goal.target)}</strong>
                </div>
              </div>

              <div className="goal-remaining">
                <span>Falta alcançar</span>
                <strong>{money(remaining)}</strong>
              </div>

              <button
                className="btn primary full"
                onClick={() => onAdd(goal)}
              >
                Adicionar dinheiro
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* =========================================================
   INVESTIMENTOS
========================================================= */

function InvestmentsPage({
  dark,
  investments,
  onNew,
  onEdit,
  onDelete,
}: {
  dark: boolean;
  investments: Investment[];
  onNew: () => void;
  onEdit: (investment: Investment) => void;
  onDelete: (id: number) => void;
}) {
  const totalInvested = investments.reduce((sum, item) => sum + item.invested, 0);
  const totalValue = investments.reduce((sum, item) => sum + item.value, 0);
  const rendimento = totalValue - totalInvested;
  const rentabilidade =
    totalInvested > 0 ? (rendimento / totalInvested) * 100 : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PATRIMÔNIO</p>
          <h1>Investimentos</h1>
          <p>Acompanhe a evolução do seu patrimônio.</p>
        </div>

        <button className="btn primary" onClick={onNew}>
          <Icon name="plus" size={17} />
          Novo investimento
        </button>
      </div>

      <div className="stats-grid three">
        <StatCard
          title="Patrimônio investido"
          value={money(totalValue)}
          subtitle="Valor atual da carteira"
          icon="chart"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Rendimento"
          value={money(rendimento)}
          subtitle="Lucro acumulado"
          icon="arrowUp"
          type={rendimento >= 0 ? "green" : "red"}
          dark={dark}
        />

        <StatCard
          title="Rentabilidade"
          value={`${rentabilidade.toFixed(2).replace(".", ",")}%`}
          subtitle="Desde o início"
          icon="chart"
          type="blue"
          dark={dark}
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelHeader
            title="Evolução patrimonial"
            subtitle="Carteira atual"
          />

          <MiniChart dark={dark} />
        </section>

        <section className="panel">
          <PanelHeader
            title="Distribuição"
            subtitle="Onde seu patrimônio está"
          />

          <div className="investment-list">
            {investments.length === 0 ? (
              <div className="empty-state">
                Nenhum investimento cadastrado.
              </div>
            ) : (
              investments.map((investment) => (
                <InvestmentRow
                  key={investment.id}
                  investment={investment}
                  totalValue={totalValue}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function InvestmentRow({
  investment,
  totalValue,
  onEdit,
  onDelete,
}: {
  investment: Investment;
  totalValue: number;
  onEdit: (investment: Investment) => void;
  onDelete: (id: number) => void;
}) {
  const percent =
    totalValue > 0 ? (investment.value / totalValue) * 100 : 0;

  return (
    <div className="investment-row">
      <div className="investment-icon">
        {investment.name.toLowerCase().includes("bitcoin")
          ? "₿"
          : investment.name.toLowerCase().includes("ethereum")
          ? "◆"
          : investment.name.toLowerCase().includes("ação")
          ? "↗"
          : "R$"}
      </div>

      <div>
        <strong>{investment.name}</strong>
        <span>{percent.toFixed(1).replace(".", ",")}% da carteira</span>
      </div>

      <strong>{money(investment.value)}</strong>

      <div className="investment-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => onEdit(investment)}
          aria-label={`Editar ${investment.name}`}
          title="Editar"
        >
          <Icon name="edit" size={15} />
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(investment.id)}
          aria-label={`Excluir ${investment.name}`}
          title="Excluir"
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   RELATÓRIOS
========================================================= */

function ReportsPage({
  dark,
  income,
  expenses,
  transactions,
}: {
  dark: boolean;
  income: number;
  expenses: number;
  transactions: Transaction[];
}) {
  const categories = transactions
    .filter((item) => item.type === "expense")
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.category] =
        (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});

  const sorted = Object.entries(categories).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ANÁLISE</p>
          <h1>Relatórios</h1>
          <p>Entenda para onde seu dinheiro está indo.</p>
        </div>
      </div>

      <div className="stats-grid three">
        <StatCard
          title="Entradas"
          value={money(income)}
          subtitle="Período atual"
          icon="arrowDown"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Despesas"
          value={money(expenses)}
          subtitle="Período atual"
          icon="arrowUp"
          type="red"
          dark={dark}
        />

        <StatCard
          title="Resultado"
          value={money(income - expenses)}
          subtitle="Saldo do período"
          icon="chart"
          type="blue"
          dark={dark}
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader
            title="Gastos por categoria"
            subtitle="Ranking das maiores despesas"
          />

          <div className="report-category-list">
            {sorted.map(([category, value]) => {
              const percent =
                expenses > 0
                  ? Math.round((value / expenses) * 100)
                  : 0;

              return (
                <div
                  className="report-category"
                  key={category}
                >
                  <div>
                    <strong>{category}</strong>
                    <span>{money(value)}</span>
                  </div>

                  <div className="progress">
                    <i style={{ width: `${percent}%` }} />
                  </div>

                  <small>{percent}%</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel chart-panel">
          <PanelHeader
            title="Fluxo financeiro"
            subtitle="Comparativo mensal"
          />

          <MiniChart dark={dark} />
        </section>
      </div>
    </>
  );
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

function SettingsPage({
  dark,
  theme,
  setTheme,
  currentMonth,
  onCloseMonth,
}: {
  dark: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  currentMonth: string;
  onCloseMonth: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SISTEMA</p>
          <h1>Configurações</h1>
          <p>Personalize sua experiência.</p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="setting-row">
          <div className="setting-icon">
            <Icon name="sun" size={18} />
          </div>

          <div className="setting-info">
            <strong>Aparência</strong>
            <span>
              Escolha entre o tema claro e escuro.
            </span>
          </div>

          <div className="theme-switch">
            <button
              className={theme === "light" ? "active" : ""}
              onClick={() => setTheme("light")}
            >
              <Icon name="sun" size={16} />
              Claro
            </button>

            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setTheme("dark")}
            >
              <Icon name="moon" size={16} />
              Escuro
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-icon">
            <Icon name="wallet" size={18} />
          </div>

          <div className="setting-info">
            <strong>Moeda principal</strong>
            <span>
              Todos os valores serão exibidos em reais.
            </span>
          </div>

          <span className="setting-value">BRL — R$</span>
        </div>

        <div className="setting-row">
          <div className="setting-icon">
            <Icon name="chart" size={18} />
          </div>

          <div className="setting-info">
            <strong>Fechamento mensal</strong>
            <span>
              Feche {monthLabel(currentMonth)} e comece o próximo mês zerado. O histórico continua salvo.
            </span>
          </div>

          <button type="button" className="btn secondary month-close-button" onClick={onCloseMonth}>
            Fechar mês
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-icon">
            <Icon name="bell" size={18} />
          </div>

          <div className="setting-info">
            <strong>Notificações</strong>
            <span>
              Alertas para contas e vencimentos.
            </span>
          </div>

          <div className="toggle active">
            <i />
          </div>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   CSS
========================================================= */

const style = `
:root {
  --green: #2fe58a;
  --green-dark: #1dbd73;
  --red: #ff5f70;
  --blue: #5d95ff;
  --orange: #f5b84b;
  --purple: #9a7cff;
  --pink: #f06aa9;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  overscroll-behavior-x: none;
  touch-action: pan-y;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.app {
  touch-action: pan-y;
  overscroll-behavior-x: none;
  --bg: #f4f7fb;
  --sidebar: #ffffff;
  --panel: #ffffff;
  --panel-2: #f8fafc;
  --text: #172231;
  --muted: #8290a3;
  --border: #e1e8f0;
  --hover: #eef3f7;
  --shadow: 0 12px 35px rgba(31, 41, 55, .055);

  min-height: 100vh;
  display: flex;
  background: var(--bg);
  color: var(--text);
}

.app.dark {
  --bg: #070c14;
  --sidebar: #0a111b;
  --panel: #0e1723;
  --panel-2: #0a121e;
  --text: #f1f5f9;
  --muted: #8796aa;
  --border: #1b2a3b;
  --hover: #142132;
  --shadow: 0 18px 50px rgba(0, 0, 0, .22);
}

.sidebar {
  width: 236px;
  min-height: 100vh;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 24px 14px 16px;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 100;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 9px 27px;
}

.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #35e58c, #20b873);
  color: white;
  box-shadow: 0 7px 18px rgba(32, 201, 120, .22);
}

.brand strong {
  display: block;
  font-size: 14px;
  letter-spacing: -.2px;
}

.brand span {
  display: block;
  font-size: 10px;
  color: var(--muted);
  margin-top: 2px;
}

.menu-label,
.eyebrow {
  font-size: 9px;
  letter-spacing: 1.3px;
  font-weight: 700;
  color: var(--muted);
}

.menu-label {
  padding: 0 11px 9px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-item-wrap {
  position: relative;
}

.nav-item-wrap .nav-hover-info {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  width: 225px;
  padding: 12px 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 16px 38px rgba(0, 0, 0, .18);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity .16s ease, transform .16s ease, visibility .16s ease;
  z-index: 1000;
}

.nav-item-wrap .nav-hover-info::before {
  content: "";
  position: absolute;
  left: -5px;
  top: 50%;
  width: 9px;
  height: 9px;
  transform: translateY(-50%) rotate(45deg);
  background: var(--panel);
  border-left: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.nav-item-wrap .nav-hover-info strong {
  font-size: 11px;
  margin-bottom: 1px;
}

.nav-item-wrap .nav-hover-info span {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.35;
}

.nav-item-wrap:hover .nav-hover-info,
.nav-item-wrap:focus-within .nav-hover-info {
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) translateX(0);
}

.nav-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 10px 11px;
  border-radius: 9px;
  font-size: 12px;
  transition: .18s ease;
}

.nav-item:hover {
  color: var(--text);
  background: var(--hover);
}

.nav-item.active {
  color: var(--green);
  background: rgba(32, 201, 120, .09);
  font-weight: 650;
}

.sidebar-bottom {
  margin-top: auto;
}

.profile {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border);
  margin-top: 14px;
  padding: 16px 7px 0;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.profile:hover {
  opacity: .9;
}

.account-popover {
  margin: 10px 4px 0;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.account-popover-title {
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 10px;
}

.account-detail {
  padding: 7px 0;
  border-top: 1px solid var(--border);
}

.account-detail span {
  display: block;
  color: var(--muted);
  font-size: 8px;
  margin-bottom: 3px;
}

.account-detail strong {
  display: block;
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--green);
  font-size: 8px;
  margin-top: 8px;
}

.account-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
}

.account-close {
  width: 100%;
  margin-top: 10px;
  padding: 7px 9px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
}

.account-close:hover {
  color: var(--text);
}

.profile .avatar,
.top-avatar {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #34445c, #718198);
  color: white;
  font-weight: 700;
}

.profile .avatar {
  width: 30px;
  height: 30px;
  font-size: 11px;
}

.profile div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.profile strong {
  display: block;
  font-size: 11px;
}

.profile span {
  display: block;
  color: var(--muted);
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.content {
  flex: 1;
  min-width: 0;
}

.topbar {
  height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 34px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(15px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.breadcrumb {
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
}

.breadcrumb b {
  color: var(--border);
}

.breadcrumb strong {
  color: var(--text);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-button,
.notification,
.icon-button {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
}

.theme-button:hover,
.notification:hover,
.icon-button:hover {
  color: var(--text);
  background: var(--hover);
}

.notification {
  position: relative;
}

.notification i {
  position: absolute;
  width: 5px;
  height: 5px;
  background: var(--green);
  border-radius: 50%;
  top: 7px;
  right: 7px;
}

.top-avatar {
  width: 34px;
  height: 34px;
  font-size: 11px;
}

.top-avatar-button {
  border: 0;
  padding: 0;
  cursor: pointer;
}

.top-avatar-button:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.top-account-popover {
  position: absolute;
  top: 56px;
  right: 34px;
  width: min(280px, calc(100vw - 32px));
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--panel);
  color: var(--text);
  box-shadow: var(--shadow);
  z-index: 60;
}

.mobile-brand {
  display: none;
}

.mobile-back-button {
  display: none;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
  place-items: center;
  font-size: 24px;
  line-height: 1;
}

.mobile-menu-button {
  display: none;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
  place-items: center;
}

.mobile-menu-overlay {
  display: none;
}

.mobile-bottom-nav {
  display: none;
}

.page {
  max-width: 1500px;
  margin: 0 auto;
  padding: 30px 34px 45px;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 25px;
}

.page-heading h1 {
  margin: 5px 0 4px;
  font-size: 23px;
  letter-spacing: -.7px;
}

.page-heading p:not(.eyebrow) {
  color: var(--muted);
  margin: 0;
  font-size: 11px;
}

.heading-actions {
  display: flex;
  gap: 9px;
  align-items: center;
}

.period,
.filter-button {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 11px;
}

.period span {
  margin-left: 14px;
  color: var(--muted);
}

.period-select {
  min-width: 145px;
  outline: none;
  cursor: pointer;
}

.month-close-button {
  white-space: nowrap;
}

.btn {
  border: 0;
  border-radius: 8px;
  padding: 10px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 650;
  font-size: 11px;
  transition: .18s ease;
}

.btn.primary {
  background: var(--green);
  color: white;
  box-shadow: 0 7px 18px rgba(32, 201, 120, .16);
}

.btn.primary:hover {
  background: var(--green-dark);
  transform: translateY(-1px);
}

.btn.secondary {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn.secondary:hover {
  background: var(--hover);
}

.btn.full {
  width: 100%;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
  margin-bottom: 15px;
}

.stats-grid.three {
  grid-template-columns: repeat(3, 1fr);
}


/* =========================================================
   DASHBOARD PREMIUM — cards e acabamento do gráfico
   Somente o Dashboard usa estas classes.
========================================================= */

.dashboard-premium-stats {
  gap: 13px;
}

.dashboard-premium-stat {
  position: relative;
  min-width: 0;
  min-height: 126px;
  overflow: hidden;
  padding: 14px 16px 13px;
  border: 1px solid rgba(255,255,255,.075);
  border-radius: 16px;
  background:
    radial-gradient(circle at 12% 10%, rgba(255,255,255,.035), transparent 34%),
    linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,0) 58%),
    var(--panel);
  box-shadow:
    var(--shadow),
    inset 0 1px 0 rgba(255,255,255,.035);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.dashboard-premium-stat:hover {
  transform: translateY(-1px);
  border-color: rgba(255,255,255,.12);
  box-shadow:
    0 14px 35px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.045);
}

.dashboard-premium-stat::after {
  content: "";
  position: absolute;
  inset: auto -25% -65% 35%;
  height: 120px;
  border-radius: 50%;
  filter: blur(32px);
  opacity: .11;
  pointer-events: none;
}

.dashboard-premium-stat.green::after { background: #39e58b; }
.dashboard-premium-stat.red::after { background: #ff6171; }
.dashboard-premium-stat.blue::after { background: #5d95ff; }

.dashboard-premium-stat-top {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 32px;
  position: relative;
  z-index: 2;
}

.dashboard-premium-stat-title {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
}

.dashboard-premium-icon {
  width: 31px;
  height: 31px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
}

.dashboard-premium-icon.green {
  color: #061b10;
  background: linear-gradient(145deg, #59ff9d, #22df7e);
  box-shadow: 0 0 20px rgba(57,229,139,.18), inset 0 1px 0 rgba(255,255,255,.32);
}

.dashboard-premium-icon.red {
  color: #fff;
  background: linear-gradient(145deg, #ff7b84, #ff4f61);
  box-shadow: 0 0 20px rgba(255,97,113,.16), inset 0 1px 0 rgba(255,255,255,.28);
}

.dashboard-premium-icon.blue {
  color: #fff;
  background: linear-gradient(145deg, #6da7ff, #477ff1);
  box-shadow: 0 0 20px rgba(93,149,255,.16), inset 0 1px 0 rgba(255,255,255,.28);
}

.dashboard-premium-value {
  display: block;
  margin-top: 7px;
  font-size: 20px;
  line-height: 1.05;
  letter-spacing: -.7px;
  position: relative;
  z-index: 2;
}

.dashboard-premium-stat.green .dashboard-premium-value { color: #39e58b; }
.dashboard-premium-stat.red .dashboard-premium-value { color: #ff6676; }
.dashboard-premium-stat.blue .dashboard-premium-value { color: #67a3ff; }

.dashboard-premium-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  position: relative;
  z-index: 2;
}

.dashboard-premium-subtitle {
  display: block;
  color: var(--muted);
  font-size: 8px;
  line-height: 1.2;
}

.dashboard-premium-trend {
  display: block;
  margin-top: 3px;
  color: #39e58b;
  font-size: 8px;
  font-weight: 800;
}

.dashboard-premium-stat.red .dashboard-premium-trend {
  color: #ff6676;
}

.dashboard-premium-trend small {
  color: var(--muted);
  font-size: 7px;
  font-weight: 600;
}

.dashboard-premium-spark {
  width: 88px;
  height: 35px;
  flex: 0 0 88px;
  overflow: visible;
  opacity: .95;
}

.dashboard-premium-stat.green .dashboard-premium-spark { color: #39e58b; }
.dashboard-premium-stat.red .dashboard-premium-spark { color: #ff6676; }
.dashboard-premium-stat.blue .dashboard-premium-spark { color: #67a3ff; }

.dashboard-premium-ring {
  width: 49px;
  height: 49px;
  margin-left: auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #57ef92;
  font-size: 9px;
  font-weight: 850;
  flex: 0 0 auto;
  box-shadow:
    0 0 20px rgba(87,239,146,.12),
    inset 0 0 8px rgba(87,239,146,.04);
}

.economy-stat {
  position: relative !important;
  padding-right: 13px;
}

.economy-stat .dashboard-premium-stat-top {
  padding-right: 39px;
}

.economy-stat .dashboard-premium-value {
  margin-top: 5px;
  font-size: 19px;
  letter-spacing: -.55px;
  padding-right: 45px;
}

.economy-stat .dashboard-premium-bottom {
  margin-top: 4px;
  padding-right: 40px;
}

.economy-stat .dashboard-premium-subtitle {
  font-size: 8px;
  font-weight: 700;
  color: #d8e2dc;
}

.economy-stat .economy-saved-label {
  margin-top: 2px;
  color: var(--muted);
  font-size: 7px;
  font-weight: 650;
}

.economy-stat .dashboard-premium-spark {
  position: absolute !important;
  right: 42px !important;
  bottom: 7px !important;
  top: auto !important;
  left: auto !important;
  width: 74px !important;
  height: 23px !important;
  margin: 0 !important;
  flex-basis: 74px !important;
  transform: none !important;
  z-index: 1 !important;
}

.investment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.investment-actions .icon-button {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
}

.economy-arrow {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 23px;
  height: 23px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #9ca9b8;
  font-size: 25px;
  line-height: 20px;
  cursor: pointer;
  transition: color .18s ease, transform .18s ease;
}

.economy-arrow:hover {
  color: #57ef92;
  transform: translateY(-50%) translateX(2px);
}

.premium-chart-stage {
  position: relative;
  width: 100%;
  padding-left: 28px;
}

.premium-chart-yaxis {
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 31px;
  width: 27px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  z-index: 2;
}

.premium-chart-yaxis span {
  color: var(--muted);
  font-size: 8px;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
}

.chart-real-data .chart-canvas {
  border-radius: 12px;
}

.chart-real-data .chart-svg {
  filter: drop-shadow(0 8px 20px rgba(0,0,0,.07));
}

.stat-card,
.panel {
  background:
    radial-gradient(circle at 18% 0%, rgba(255,255,255,.025), transparent 34%),
    linear-gradient(145deg, rgba(255,255,255,.018), transparent 55%),
    var(--panel);
  border: 1px solid rgba(255,255,255,.065);
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,.025);
  border-radius: 14px;
}

.stat-card {
  padding: 17px 18px;
  min-height: 112px;
}

.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-top > span {
  font-size: 10px;
  color: var(--muted);
}

.stat-icon {
  width: 29px;
  height: 29px;
  border-radius: 8px;
  display: grid;
  place-items: center;
}

.stat-icon.green {
  color: var(--green);
  background: rgba(32, 201, 120, .1);
}

.stat-icon.red {
  color: var(--red);
  background: rgba(239, 83, 96, .1);
}

.stat-icon.blue {
  color: var(--blue);
  background: rgba(79, 140, 255, .1);
}

.stat-value {
  display: block;
  margin-top: 9px;
  font-size: 19px;
  letter-spacing: -.5px;
}

.stat-value.green {
  color: var(--green);
}

.stat-value.red {
  color: var(--red);
}

.stat-value.blue {
  color: var(--blue);
}

.stat-subtitle {
  display: block;
  margin-top: 4px;
  font-size: 9px;
  color: var(--muted);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.bottom-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 14px;
}

.panel {
  padding: 18px;
  min-width: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 17px;
}

.panel-header h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: -.2px;
}

.panel-header p {
  margin: 4px 0 0;
  font-size: 9px;
  color: var(--muted);
}

.panel-action {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 9px;
}

.panel-action:hover,
.text-button:hover {
  color: var(--green);
}

.legend {
  display: flex;
  gap: 15px;
  font-size: 9px;
  color: var(--muted);
  margin-bottom: 5px;
}

.legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 7px;
  height: 7px;
  display: inline-block;
  border-radius: 50%;
}

.dot.green {
  background: #2fe58a;
}

.dot.red {
  background: #ff5f70;
}

.dot.blue {
  background: #5d95ff;
}

.dot.orange {
  background: #f5b84b;
}

.dot.purple {
  background: #9a7cff;
}

.dot.pink {
  background: #f06aa9;
}

.dot.gray {
  background: #64748b;
}

.mini-chart-wrap {
  position: relative;
  width: 100%;
}

.chart-svg {
  display: block;
  margin-top: 8px;
  touch-action: pan-y;
}

.chart-days {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 8px;
  padding: 0 3px;
}

.category-content {
  display: flex;
  align-items: center;
  gap: 17px;
}

.donut-wrap {
  width: 145px;
  min-width: 145px;
  display: grid;
  place-items: center;
}

.donut {
  width: 125px;
  height: 125px;
  border-radius: 50%;
  background:
    conic-gradient(
      #2fe58a 0 40%,
      #5d95ff 40% 57%,
      #f5b84b 57% 68%,
      #9a7cff 68% 77%,
      #f06aa9 77% 84%,
      #64748b 84% 100%
    );
  display: grid;
  place-items: center;
}

.donut-center {
  width: 82px;
  height: 82px;
  background: var(--panel);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.donut-center strong {
  font-size: 12px;
}

.donut-center span {
  color: var(--muted);
  font-size: 8px;
  margin-top: 3px;
}

.category-list {
  flex: 1;
}

.category-line {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 9px;
  align-items: center;
  padding: 5px 0;
  font-size: 9px;
}

.category-line > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-line strong {
  font-size: 9px;
}

.category-line small {
  color: var(--muted);
  width: 24px;
  text-align: right;
}

.text-button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 9px;
  padding: 14px 0 0;
}

.transaction-list,
.bill-list,
.goal-list,
.purchase-list {
  display: flex;
  flex-direction: column;
}

.transaction-row {
  display: grid;
  grid-template-columns: 29px 1fr auto auto;
  gap: 9px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.transaction-row:last-child {
  border-bottom: 0;
}

.transaction-icon,
.table-icon {
  display: grid;
  place-items: center;
  border-radius: 8px;
}

.transaction-icon {
  width: 29px;
  height: 29px;
  font-size: 13px;
}

.transaction-icon.income,
.table-icon.income {
  background: rgba(32, 201, 120, .1);
  color: var(--green);
}

.transaction-icon.expense,
.table-icon.expense {
  background: rgba(239, 83, 96, .1);
  color: var(--red);
}

.transaction-info strong,
.transaction-info span {
  display: block;
}

.transaction-info strong {
  font-size: 10px;
}

.transaction-info span,
.transaction-date {
  color: var(--muted);
  font-size: 8px;
  margin-top: 2px;
}

.amount {
  font-size: 10px;
}

.income-text {
  color: var(--green);
}

.expense-text {
  color: var(--red);
}

.bill-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.bill-row:last-child {
  border-bottom: 0;
}

.bill-icon {
  width: 29px;
  height: 29px;
  border-radius: 8px;
  background: rgba(79, 140, 255, .1);
  color: var(--blue);
  display: grid;
  place-items: center;
}

.bill-info {
  flex: 1;
}

.bill-info strong,
.bill-info span {
  display: block;
}

.bill-info strong {
  font-size: 10px;
}

.bill-info span {
  font-size: 8px;
  color: var(--muted);
  margin-top: 2px;
}

.bill-value {
  text-align: right;
}

.bill-value strong {
  display: block;
  font-size: 10px;
}

.bill-value span,
.status {
  display: inline-block;
  font-size: 8px;
  margin-top: 3px;
}

.paid {
  color: var(--green);
}

.pending {
  color: var(--orange);
}

.panel-total {
  border-top: 1px solid var(--border);
  padding-top: 11px;
  margin-top: 7px;
  display: flex;
  justify-content: space-between;
  font-size: 9px;
}

.panel-total strong {
  color: var(--red);
}

.goal-mini {
  padding: 9px 0;
}

.goal-mini-top,
.goal-mini-bottom {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.goal-mini-top {
  font-size: 9px;
}

.goal-mini-top strong {
  color: var(--green);
}

.goal-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-mini-bottom {
  color: var(--muted);
  font-size: 8px;
  margin-top: 4px;
}

.progress {
  height: 5px;
  border-radius: 99px;
  background: var(--border);
  overflow: hidden;
  margin-top: 7px;
}

.progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2fe58a, #48df91);
}

.progress.large {
  height: 7px;
}

.table-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 17px;
}

.search-box {
  flex: 1;
  max-width: 400px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 11px;
  gap: 8px;
  color: var(--muted);
  background: var(--panel-2);
}

.search-box input {
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  width: 100%;
  font-size: 10px;
}

.table {
  width: 100%;
  overflow-x: auto;
}

.table-head,
.table-row {
  min-width: 700px;
  display: grid;
  grid-template-columns: 2fr 1.2fr 1.2fr 1fr 1.1fr 35px;
  gap: 10px;
  align-items: center;
}

.table-head {
  padding: 9px 8px;
  color: var(--muted);
  font-size: 8px;
  letter-spacing: .8px;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
}

.table-row {
  padding: 12px 8px;
  border-bottom: 1px solid var(--border);
  font-size: 9px;
}

.table-description {
  display: flex;
  align-items: center;
  gap: 9px;
}

.table-icon {
  width: 28px;
  height: 28px;
}

.table-row > span {
  color: var(--muted);
}

.delete-button,
.check-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
}.delete-button:hover {
  color: var(--red);
  background: rgba(239, 83, 96, .08);
}

.check-button:hover {
  color: var(--green);
  background: rgba(32, 201, 120, .08);
}

.empty {
  padding: 35px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
}

.bill-page-list {
  display: flex;
  flex-direction: column;
}

.bill-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
  border-bottom: 1px solid var(--border);
}

.bill-date {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(79, 140, 255, .08);
  color: var(--blue);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bill-date strong {
  font-size: 16px;
}

.bill-date span {
  font-size: 8px;
  text-transform: uppercase;
}

.bill-main {
  flex: 1;
}

.bill-main strong,
.bill-main span {
  display: block;
}

.bill-main strong {
  font-size: 11px;
}

.bill-main span {
  color: var(--muted);
  font-size: 9px;
  margin-top: 3px;
}

.bill-main-value {
  min-width: 130px;
  text-align: right;
}

.bill-main-value strong {
  display: block;
  font-size: 11px;
}

.status {
  padding: 3px 7px;
  border-radius: 20px;
  background: var(--panel-2);
}

.cards-layout {
  display: grid;
  grid-template-columns: .8fr 1.4fr;
  gap: 14px;
}

.credit-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.credit-card {
  width: 100%;
  min-height: 160px;
  border: 1px solid var(--border);
  border-radius: 14px;
  color: white;
  text-align: left;
  padding: 17px;
  background:
    radial-gradient(
      circle at 85% 15%,
      rgba(255,255,255,.18),
      transparent 28%
    ),
    linear-gradient(135deg, #17283a, #0c1520);
  transition: .18s ease;
}

.credit-card:hover {
  border-color: rgba(32, 201, 120, .45);
}

.card-edit-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 30px;
  margin-top: 4px;
  margin-bottom: 2px;
}

.card-edit-button {
  position: static;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(5, 14, 26, .72);
  color: var(--muted);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.card-edit-button:hover {
  color: var(--text);
  border-color: var(--green);
}

.credit-card {
  position: relative;
}

.credit-card.selected {
  border-color: rgba(32, 201, 120, .7);
  transform: translateY(-2px);
}

.credit-card:nth-child(2) {
  background:
    radial-gradient(
      circle at 15% 90%,
      rgba(79,140,255,.25),
      transparent 30%
    ),
    linear-gradient(135deg, #182235, #0b1421);
}

.credit-card-top,
.credit-card-bottom,
.card-limit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.credit-card-top {
  font-size: 11px;
}

.credit-card-top strong {
  font-size: 9px;
  opacity: .75;
}

.card-number {
  font-size: 16px;
  letter-spacing: 2px;
  margin: 29px 0 20px;
}

.credit-card-bottom {
  font-size: 8px;
  opacity: .7;
}

.card-progress {
  height: 3px;
  background: rgba(255,255,255,.15);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 10px;
}

.card-progress i {
  display: block;
  height: 100%;
  background: var(--green);
}

.card-limit-row {
  font-size: 8px;
  margin-top: 5px;
  opacity: .7;
}

.invoice-panel {
  min-width: 0;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 25px;
}

.invoice-header h2 {
  margin: 5px 0 0;
  font-size: 16px;
}

.invoice-header h2 span {
  color: var(--muted);
  font-size: 11px;
}

.invoice-value {
  text-align: right;
}

.invoice-value span {
  display: block;
  color: var(--muted);
  font-size: 9px;
}

.invoice-value strong {
  display: block;
  color: var(--green);
  font-size: 19px;
  margin-top: 4px;
}

.invoice-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  margin: -8px 0 20px;
  border: 1px solid rgba(245, 158, 11, .18);
  border-radius: 10px;
  background: rgba(245, 158, 11, .07);
}

.invoice-status > div {
  min-width: 0;
}

.invoice-status span,
.invoice-status strong,
.invoice-status small {
  display: block;
}

.invoice-status span {
  color: var(--muted);
  font-size: 8px;
}

.invoice-status strong {
  margin-top: 3px;
  font-size: 11px;
  color: #f5b84b;
}

.invoice-status small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 8px;
}

.invoice-status.paid {
  border-color: rgba(32, 201, 120, .22);
  background: rgba(32, 201, 120, .07);
}

.invoice-status.paid strong {
  color: var(--green);
}

.invoice-status.pending {
  border-color: rgba(245, 158, 11, .28);
  background: rgba(245, 158, 11, .08);
}

.invoice-status.pending strong {
  color: #f5b84b;
}

.invoice-status.upcoming {
  border-color: var(--border);
  background: var(--panel-2);
}

.invoice-status.upcoming strong {
  color: var(--text);
}

.invoice-paid-button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid rgba(32, 201, 120, .3);
  border-radius: 9px;
  background: rgba(32, 201, 120, .12);
  color: var(--green);
  font: inherit;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
  transition: .18s ease;
}

.invoice-paid-button:hover {
  background: rgba(32, 201, 120, .2);
  transform: translateY(-1px);
}

.invoice-paid-button.paid-button {
  border-color: var(--border);
  background: var(--panel-2);
  color: var(--muted);
}

.card-day-fields {
  grid-column: 1 / -1;
  margin: -2px 0 -2px;
}

.card-day-help {
  display: block;
  color: var(--muted);
  font-size: 8px;
  line-height: 1.45;
}

.invoice-progress-top,
.invoice-progress-bottom {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 9px;
}

.invoice-progress-bottom {
  margin-top: 7px;
}

.invoice-progress-bottom strong {
  color: var(--green);
}

.invoice-info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 22px 0 27px;
}

.invoice-info-grid div {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 10px;
}

.invoice-info-grid span,
.invoice-info-grid strong {
  display: block;
}

.invoice-info-grid span {
  color: var(--muted);
  font-size: 8px;
}

.invoice-info-grid strong {
  font-size: 10px;
  margin-top: 5px;
}

.purchase-row {
  display: grid;
  grid-template-columns: 31px 1fr auto 30px;
  align-items: center;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.purchase-icon {
  width: 31px;
  height: 31px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(79, 140, 255, .1);
  color: var(--blue);
}

.purchase-info strong,
.purchase-info span {
  display: block;
}

.purchase-info strong {
  font-size: 10px;
}

.purchase-info span {
  color: var(--muted);
  font-size: 8px;
  margin-top: 3px;
}

.purchase-value {
  text-align: right;
}

.purchase-value strong,
.purchase-value span {
  display: block;
}

.purchase-value strong {
  font-size: 10px;
}

.purchase-value span {
  color: var(--muted);
  font-size: 8px;
  margin-top: 3px;
}

.installment-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(32, 201, 120, .07);
  border: 1px solid rgba(32, 201, 120, .15);
  padding: 12px;
  border-radius: 9px;
  margin-top: 14px;
}

.installment-preview span {
  color: var(--muted);
  font-size: 9px;
}

.installment-preview strong {
  color: var(--green);
  font-size: 14px;
}

.goal-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.goal-card {
  min-height: 300px;
}

.goal-card-top {
  display: flex;
  justify-content: space-between;
}

.goal-big-icon {
  width: 45px;
  height: 45px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--panel-2);
  border: 1px solid var(--border);
  font-size: 21px;
}

.goal-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.goal-edit-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  transition: .18s ease;
}

.goal-edit-button:hover {
  color: var(--blue);
  background: rgba(79, 140, 255, .08);
  border-color: rgba(79, 140, 255, .35);
}

.goal-card h2 {
  font-size: 14px;
  margin: 18px 0 13px;
}

.goal-progress-number {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.goal-progress-number strong {
  color: var(--green);
  font-size: 22px;
}

.goal-progress-number span {
  color: var(--muted);
  font-size: 9px;
}

.goal-values {
  display: flex;
  justify-content: space-between;
  margin-top: 13px;
}

.goal-values span,
.goal-values strong {
  display: block;
}

.goal-values span {
  color: var(--muted);
  font-size: 8px;
}

.goal-values strong {
  font-size: 10px;
  margin-top: 3px;
}

.goal-remaining {
  display: flex;
  justify-content: space-between;
  margin: 20px 0;
  padding: 10px;
  border-radius: 8px;
  background: var(--panel-2);
}

.goal-remaining span {
  color: var(--muted);
  font-size: 9px;
}

.goal-remaining strong {
  color: var(--green);
  font-size: 9px;
}

.investment-list {
  display: flex;
  flex-direction: column;
}

.investment-row {
  display: grid;
  grid-template-columns: 36px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.investment-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: rgba(32, 201, 120, .09);
  color: var(--green);
  font-weight: 700;
}

.investment-row strong,
.investment-row span {
  display: block;
}

.investment-row strong {
  font-size: 10px;
}

.investment-row span {
  color: var(--muted);
  font-size: 8px;
  margin-top: 3px;
}

.report-category-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.report-category > div:first-child {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
}

.report-category > div:first-child span {
  color: var(--muted);
}

.report-category small {
  display: block;
  text-align: right;
  color: var(--muted);
  font-size: 8px;
  margin-top: 4px;
}

.settings-panel {
  max-width: 850px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(32, 201, 120, .08);
  color: var(--green);
  display: grid;
  place-items: center;
}

.setting-info {
  flex: 1;
}

.setting-info strong,
.setting-info span {
  display: block;
}

.setting-info strong {
  font-size: 11px;
}

.setting-info span {
  color: var(--muted);
  font-size: 9px;
  margin-top: 3px;
}

.setting-value {
  color: var(--muted);
  font-size: 10px;
}

.theme-switch {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
}

.theme-switch button {
  border: 0;
  background: transparent;
  color: var(--muted);
  border-radius: 6px;
  padding: 7px 9px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
}

.theme-switch button.active {
  color: var(--text);
  background: var(--panel);
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}

.toggle {
  width: 35px;
  height: 20px;
  background: var(--border);
  border-radius: 99px;
  padding: 3px;
}

.toggle i {
  display: block;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
}

.toggle.active {
  background: var(--green);
}

.toggle.active i {
  margin-left: 15px;
}

/* MODAL */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal {
  width: min(580px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  background: #fff;
  color: #172231;
  border-radius: 16px;
  padding: 21px;
  box-shadow: 0 30px 90px rgba(0,0,0,.25);
}

.modal-dark {
  background: #0e1723;
  color: #f1f5f9;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 21px;
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
}

.modal-header p {
  margin: 4px 0 0;
  color: #8290a3;
  font-size: 9px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 13px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 9px;
  font-weight: 650;
}

.input {
  width: 100%;
  height: 38px;
  border: 1px solid #e1e6ee;
  border-radius: 8px;
  background: #f8fafc;
  color: #172231;
  padding: 0 10px;
  outline: none;
  font-size: 10px;
}

.input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(32,201,120,.08);
}

.input-dark {
  background: #0a121e;
  border-color: #263449;
  color: #f1f5f9;
}

.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  margin-bottom: 15px;
}

.type-switch button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 9px;
  border-radius: 7px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  font-size: 10px;
}

.type-switch button.active {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 2px 7px rgba(0,0,0,.08);
}

.type-switch button.expense.active {
  color: var(--red);
}

.type-switch button.income.active {
  color: var(--green);
}

.goal-amount-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 11px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-2);
}

.goal-amount-summary > div {
  min-width: 0;
}

.goal-amount-summary span,
.goal-amount-summary strong {
  display: block;
}

.goal-amount-summary span {
  color: var(--muted);
  font-size: 9px;
  margin-bottom: 4px;
}

.goal-amount-summary strong {
  font-size: 11px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 21px;
}


/* =========================================================
   FLUXO FINANCEIRO — acabamento premium
   ========================================================= */
.chart-panel {
  overflow: hidden;
  position: relative;
}

.chart-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background:
    radial-gradient(circle at 12% 100%, rgba(47, 229, 138, .035), transparent 34%),
    radial-gradient(circle at 88% 8%, rgba(93, 149, 255, .025), transparent 30%);
}

.chart-real-data {
  padding-top: 1px;
}

.chart-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 8px 0 8px;
  position: relative;
  z-index: 1;
}

.chart-summary-card {
  min-width: 0;
  padding: 10px 12px 11px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, .028),
    rgba(255, 255, 255, 0)
  ), var(--panel-2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
}

.app:not(.dark) .chart-summary-card {
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, .95),
    rgba(247, 250, 253, .92)
  );
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
}

.chart-summary-card span {
  display: block;
  color: var(--muted);
  font-size: 8px;
  font-weight: 750;
  letter-spacing: .65px;
  margin-bottom: 5px;
  white-space: nowrap;
}

.chart-summary-card strong {
  display: block;
  font-size: 12px;
  line-height: 1.1;
  letter-spacing: -.25px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-summary-income {
  color: #2fe58a;
}

.chart-summary-expense {
  color: #ff5f70;
}

.chart-summary-card.income-card {
  box-shadow: inset 0 1px 0 rgba(47,229,138,.05);
}

.chart-summary-card.expense-card {
  box-shadow: inset 0 1px 0 rgba(255,95,112,.045);
}

.chart-summary-card.balance-card {
  box-shadow: inset 0 1px 0 rgba(93,149,255,.05);
}

.chart-summary-card.balance-card.negative {
  box-shadow: inset 0 1px 0 rgba(255,95,112,.05);
}

.chart-canvas {
  position: relative;
  z-index: 1;
  padding: 0 1px 1px;
}

.chart-svg {
  display: block;
  width: 100%;
  margin-top: 2px;
  overflow: visible;
  touch-action: pan-y;
}

.chart-days {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .15px;
  padding: 0 4px;
  margin-top: -1px;
}

.chart-days span {
  min-width: 18px;
  text-align: center;
}

.stat-card,
.panel {
  border-radius: 13px;
}

.app.dark .stat-card,
.app.dark .panel {
  background:
    linear-gradient(145deg, rgba(255,255,255,.012), rgba(255,255,255,0)),
    var(--panel);
  box-shadow:
    0 18px 48px rgba(0,0,0,.20),
    inset 0 1px 0 rgba(255,255,255,.018);
}

.app:not(.dark) .stat-card,
.app:not(.dark) .panel {
  box-shadow:
    0 14px 35px rgba(31,41,55,.045),
    inset 0 1px 0 rgba(255,255,255,.85);
}

.app.dark .chart-panel {
  border-color: #1d2c3e;
}

.legend {
  position: relative;
  z-index: 1;
  gap: 18px;
}

.legend span {
  font-weight: 600;
}

.dot.green,
.dot.red {
  box-shadow: 0 0 0 3px rgba(255,255,255,.018), 0 0 12px currentColor;
}

.dot.green {
  color: #2fe58a;
  background: #2fe58a;
}

.dot.red {
  color: #ff5f70;
  background: #ff5f70;
}



/* =========================================================
   DASHBOARD GLASS / PREMIUM POLISH
   Mantém as funções e estrutura; apenas acabamento visual.
========================================================= */

.dashboard-grid .panel,
.bottom-grid .panel {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, .12);
  border-radius: 16px;
  background:
    radial-gradient(circle at 8% 0%, rgba(90, 145, 255, .045), transparent 38%),
    linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,0) 55%),
    var(--panel);
  box-shadow:
    0 18px 45px rgba(0,0,0,.12),
    inset 0 1px 0 rgba(255,255,255,.035);
}

.dashboard-grid .panel::before,
.bottom-grid .panel::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(255,255,255,.025),
    transparent 34%,
    transparent 70%,
    rgba(255,255,255,.012)
  );
}

.dashboard-grid .panel-header,
.bottom-grid .panel-header {
  position: relative;
  z-index: 2;
}

.dashboard-grid .panel-header h2,
.bottom-grid .panel-header h2 {
  font-size: 14px;
  letter-spacing: -.35px;
  font-weight: 780;
}

.dashboard-grid .panel-header p,
.bottom-grid .panel-header p {
  font-size: 9px;
  opacity: .88;
}

/* ---------- Category card: referência premium ---------- */

.dashboard-grid .category-panel {
  padding: 19px 18px 16px;
  min-height: 310px;
}

.category-panel .category-content {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 155px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  margin-top: 4px;
}

.category-panel .donut-wrap {
  width: 155px;
  min-width: 155px;
}

.category-panel .donut {
  width: 137px;
  height: 137px;
  box-shadow:
    0 0 28px rgba(47,229,138,.07),
    inset 0 0 0 1px rgba(255,255,255,.05);
}

.category-panel .donut-center {
  width: 86px;
  height: 86px;
  background:
    radial-gradient(circle at 45% 35%, rgba(255,255,255,.035), transparent 60%),
    var(--panel);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
}

.category-panel .donut-center strong {
  font-size: 13px;
  letter-spacing: -.3px;
}

.category-panel .donut-center span {
  font-size: 8px;
}

.category-panel .category-list {
  min-width: 0;
}

.category-panel .category-line {
  grid-template-columns: minmax(80px,1fr) auto auto;
  gap: 7px;
  min-height: 28px;
  padding: 2px 0;
  font-size: 9px;
}

.category-panel .category-line > div {
  gap: 7px;
  min-width: 0;
}

.category-panel .category-line > div span:last-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-panel .category-line strong {
  font-size: 9px;
  font-weight: 780;
  white-space: nowrap;
}

.category-panel .category-line small {
  width: 30px;
  font-size: 8px;
  font-weight: 650;
  white-space: nowrap;
}

.category-panel .text-button {
  position: relative;
  z-index: 2;
  margin-top: 7px;
  padding-top: 8px;
  font-size: 9px;
  color: #65a8ff;
  font-weight: 700;
}

.category-panel .text-button:hover {
  color: #76ffad;
}

/* A linha multicolorida da referência abaixo do donut/lista. */
.category-panel::after {
  content: "";
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 34px;
  height: 4px;
  border-radius: 99px;
  background:
    linear-gradient(
      90deg,
      #39ef86 0 40%,
      #168cff 40% 57%,
      #ffb51f 57% 68%,
      #8b78ff 68% 77%,
      #f06da9 77% 84%,
      #8ba0b7 84% 100%
    );
  opacity: .92;
  box-shadow: 0 0 13px rgba(57,239,134,.10);
  pointer-events: none;
}

/* ---------- Cards inferiores com a mesma linguagem visual ---------- */

.bottom-grid .panel {
  padding: 17px 18px;
}

.bottom-grid .panel:hover,
.dashboard-grid .panel:hover {
  border-color: rgba(115, 168, 255, .16);
  box-shadow:
    0 20px 48px rgba(0,0,0,.15),
    inset 0 1px 0 rgba(255,255,255,.04);
}

/* ---------- Gráfico premium: grid e brilho sem tocar nos dados ---------- */

.chart-panel {
  background:
    radial-gradient(circle at 38% 55%, rgba(63, 105, 164, .055), transparent 50%),
    linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,0) 60%),
    var(--panel) !important;
}

.chart-panel .legend {
  position: relative;
  z-index: 3;
  gap: 18px;
}

.chart-panel .legend span {
  font-weight: 650;
}

.chart-panel .chart-svg {
  filter:
    drop-shadow(0 7px 16px rgba(47,229,138,.08))
    drop-shadow(0 7px 16px rgba(255,95,112,.07));
}

/* ---------- Ajuste de densidade para ficar como a referência ---------- */

@media (min-width: 1100px) {
  .dashboard-premium-stat {
    min-height: 132px;
    padding: 15px 17px 13px;
  }

  .dashboard-premium-value {
    font-size: 21px;
  }
}

@media (max-width: 980px) {
  .category-panel .category-content {
    grid-template-columns: 135px minmax(0, 1fr);
  }

  .category-panel .donut-wrap {
    width: 135px;
    min-width: 135px;
  }

  .category-panel .donut {
    width: 122px;
    height: 122px;
  }
}

@media (max-width: 560px) {
  .dashboard-grid .category-panel {
    min-height: 0;
  }

  .category-panel .category-content {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .category-panel .category-list {
    width: 100%;
  }

  .category-panel::after {
    bottom: 38px;
  }
}

@media (max-width: 900px) {
  .dashboard-premium-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-premium-spark {
    width: 72px;
    flex-basis: 72px;
  }
}

@media (max-width: 560px) {
  .dashboard-premium-stats {
    grid-template-columns: 1fr;
  }

  .dashboard-premium-stat {
    min-height: 118px;
  }

  .premium-chart-stage {
    padding-left: 25px;
  }

  .premium-chart-yaxis {
    width: 24px;
  }
}

@media (max-width: 650px) {
  .chart-summary {
    gap: 7px;
  }

  .chart-summary-card {
    padding: 8px 9px 9px;
    border-radius: 10px;
  }

  .chart-summary-card span {
    font-size: 7px;
    letter-spacing: .45px;
  }

  .chart-summary-card strong {
    font-size: 10px;
  }

  .chart-days {
    font-size: 8px;
  }
}

@media (max-width: 650px) {
  .chart-summary {
    gap: 6px;
  }

  .chart-summary > div {
    padding: 7px 8px;
  }

  .chart-summary span {
    font-size: 7px;
  }

  .chart-summary strong {
    font-size: 9px;
  }
}

/* Pequeno aumento de legibilidade somente em telas de PC */
@media (min-width: 851px) {
  .panel-header h2 { font-size: 15px; }
  .panel-header p { font-size: 11px; }
  .panel-action { font-size: 11px; }
  .legend { font-size: 11px; }
  .chart-days { font-size: 10px; }
  .category-line { font-size: 11px; }
  .category-line strong { font-size: 11px; }
  .category-line small { font-size: 10px; }
  .text-button { font-size: 11px; }
  .transaction-info strong { font-size: 12px; }
  .transaction-info span,
  .transaction-date { font-size: 10px; }
  .amount { font-size: 12px; }
  .bill-info strong { font-size: 12px; }
  .bill-info span { font-size: 10px; }
  .bill-value strong { font-size: 12px; }
  .bill-value span,
  .status { font-size: 10px; }
  .panel-total { font-size: 11px; }
  .goal-mini-top { font-size: 11px; }
  .goal-mini-bottom { font-size: 10px; }
}

/* RESPONSIVO */

@media (max-width: 1150px) {
  .sidebar {
    width: 205px;
  }

  .bottom-grid {
    grid-template-columns: 1fr 1fr;
  }

  .bottom-grid > :last-child {
    grid-column: span 2;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .goal-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 850px) {
  .sidebar {
    display: flex;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: min(280px, 84vw);
    height: 100dvh;
    min-height: 100dvh;
    z-index: 100;
    transform: translateX(-105%);
    transition: transform .22s ease;
    box-shadow: 18px 0 45px rgba(0,0,0,.22);
  }

  .sidebar.mobile-sidebar-open {
    transform: translateX(0);
  }

  .nav-hover-info {
    display: none !important;
  }

  .mobile-menu-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0,0,0,.48);
    backdrop-filter: blur(2px);
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    min-width: 0;
  }

  .mobile-brand strong {
    white-space: nowrap;
  }

  .mobile-menu-button,
  .mobile-back-button {
    display: grid;
  }

  .mobile-bottom-nav {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    height: 66px;
    z-index: 80;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: stretch;
    gap: 2px;
    padding: 7px 5px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--panel) 94%, transparent);
    box-shadow: 0 14px 35px rgba(0,0,0,.22);
    backdrop-filter: blur(18px);
  }

  .mobile-bottom-nav button {
    min-width: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px 2px;
    font: inherit;
    cursor: pointer;
  }

  .mobile-bottom-nav button.active {
    background: var(--hover);
    color: #20d77f;
  }

  .mobile-bottom-nav button span {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9px;
    font-weight: 700;
  }

  .content {
    padding-bottom: 88px;
  }

  .breadcrumb {
    display: none;
  }

  .topbar {
    padding: 0 18px;
  }

  .top-account-popover {
    top: 58px;
    right: 16px;
    width: min(300px, calc(100vw - 32px));
  }

  .top-avatar-button {
    min-width: 38px;
    min-height: 38px;
  }

  .page {
    padding: 22px 16px 35px;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions {
    width: 100%;
  }

  .heading-actions .btn,
  .heading-actions .period {
    flex: 1;
  }

  .dashboard-grid,
  .cards-layout {
    grid-template-columns: 1fr;
  }

  .bottom-grid {
    grid-template-columns: 1fr;
  }

  .bottom-grid > :last-child {
    grid-column: auto;
  }

  .category-content {
    flex-direction: column;
  }

  .category-list {
    width: 100%;
  }

  .goal-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 580px) {
  .stats-grid,
  .stats-grid.three {
    grid-template-columns: 1fr;
  }

  .goal-amount-summary {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .invoice-header {
    flex-direction: column;
  }

  .invoice-value {
    text-align: left;
  }

  .invoice-status {
    align-items: stretch;
    flex-direction: column;
  }

  .invoice-paid-button {
    width: 100%;
  }

  .invoice-info-grid {
    grid-template-columns: 1fr;
  }

  .table-toolbar {
    flex-wrap: wrap;
  }

  .search-box {
    max-width: none;
    width: 100%;
  }

  .setting-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .setting-info {
    min-width: calc(100% - 55px);
  }

  .theme-switch {
    margin-left: 51px;
  }
}

/* =========================================================
   DASHBOARD REFINEMENT V4 — referência visual enviada
   Somente acabamento dos 4 cards superiores.
   Não altera regras de negócio nem os demais módulos.
========================================================= */

.dashboard-premium-stats {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

.dashboard-premium-stat {
  min-height: 126px;
  height: 126px;
  box-sizing: border-box;
  padding: 15px 15px 13px;
  border-radius: 15px;
  border: 1px solid rgba(255,255,255,.085);
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(135deg, rgba(255,255,255,.045), rgba(255,255,255,.008) 48%, rgba(0,0,0,.10)),
    var(--panel);
  box-shadow:
    0 12px 30px rgba(0,0,0,.22),
    inset 0 1px 0 rgba(255,255,255,.055),
    inset 0 -1px 0 rgba(0,0,0,.18);
}

.app.dark .dashboard-premium-stat.green {
  background:
    radial-gradient(circle at 8% 105%, rgba(57,229,139,.075), transparent 48%),
    linear-gradient(135deg, rgba(42,102,74,.22), rgba(16,25,27,.55) 62%),
    #111a1d;
  border-color: rgba(57,229,139,.16);
}

.app.dark .dashboard-premium-stat.red {
  background:
    radial-gradient(circle at 8% 105%, rgba(255,95,112,.075), transparent 48%),
    linear-gradient(135deg, rgba(106,45,56,.22), rgba(24,22,27,.56) 62%),
    #15191e;
  border-color: rgba(255,95,112,.14);
}

.app.dark .dashboard-premium-stat.blue {
  background:
    radial-gradient(circle at 8% 105%, rgba(78,143,255,.085), transparent 48%),
    linear-gradient(135deg, rgba(34,67,107,.25), rgba(17,24,32,.58) 62%),
    #121a25;
  border-color: rgba(78,143,255,.15);
}

.dashboard-premium-stat::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  border-radius: inherit;
  background:
    linear-gradient(115deg, rgba(255,255,255,.035), transparent 30%),
    radial-gradient(circle at 100% 100%, rgba(255,255,255,.025), transparent 42%);
}

.dashboard-premium-stat:hover {
  transform: translateY(-1px);
  border-color: rgba(255,255,255,.14);
  box-shadow:
    0 16px 36px rgba(0,0,0,.25),
    inset 0 1px 0 rgba(255,255,255,.07);
}

.dashboard-premium-stat-top {
  min-height: 38px;
  gap: 9px;
  align-items: center;
}

.dashboard-premium-icon {
  width: 38px;
  height: 38px;
  min-width: 38px;
  border-radius: 50%;
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.30),
    0 0 22px rgba(255,255,255,.06);
}

.dashboard-premium-icon.green {
  background: linear-gradient(145deg, #63ff9f 0%, #22e37e 70%, #13ca6b 100%);
  box-shadow:
    0 0 20px rgba(57,229,139,.20),
    inset 0 1px 1px rgba(255,255,255,.35);
}

.dashboard-premium-icon.red {
  background: linear-gradient(145deg, #ff777f 0%, #ff4f61 70%, #ec354d 100%);
  box-shadow:
    0 0 20px rgba(255,95,112,.18),
    inset 0 1px 1px rgba(255,255,255,.32);
}

.dashboard-premium-icon.blue {
  background: linear-gradient(145deg, #5ea3ff 0%, #387ef0 70%, #2465d8 100%);
  box-shadow:
    0 0 20px rgba(78,143,255,.19),
    inset 0 1px 1px rgba(255,255,255,.32);
}

.dashboard-premium-stat-title {
  color: #eef3f7;
  font-size: 12px;
  line-height: 1;
  font-weight: 750;
  letter-spacing: -.05px;
}

.dashboard-premium-value {
  margin-top: 6px;
  font-size: 21px;
  line-height: 1.05;
  letter-spacing: -.75px;
  font-weight: 820;
  text-shadow: 0 0 18px rgba(255,255,255,.025);
}

.dashboard-premium-stat.green .dashboard-premium-value {
  color: #48ef91;
}

.dashboard-premium-stat.red .dashboard-premium-value {
  color: #ff6878;
}

.dashboard-premium-stat.blue .dashboard-premium-value {
  color: #54a2ff;
}

.dashboard-premium-bottom {
  margin-top: 6px;
  min-height: 39px;
  align-items: flex-end;
}

.dashboard-premium-subtitle {
  color: rgba(224,232,239,.68);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .05px;
}

.dashboard-premium-trend {
  margin-top: 4px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .05px;
}

.dashboard-premium-trend small {
  font-size: 8px;
  color: rgba(224,232,239,.55);
  font-weight: 600;
}

.dashboard-premium-spark {
  width: 91px;
  height: 34px;
  flex: 0 0 91px;
  margin-bottom: -1px;
  opacity: 1;
  overflow: visible;
}

.dashboard-premium-stat.green .dashboard-premium-spark {
  color: #55f49a;
  filter: drop-shadow(0 0 5px rgba(85,244,154,.16));
}

.dashboard-premium-stat.red .dashboard-premium-spark {
  color: #ff6878;
  filter: drop-shadow(0 0 5px rgba(255,104,120,.14));
}

.dashboard-premium-stat.blue .dashboard-premium-spark {
  color: #55a5ff;
  filter: drop-shadow(0 0 5px rgba(85,165,255,.15));
}

/* Economia: composição igual à referência — círculo à esquerda,
   conteúdo à direita e seta no extremo direito. */
.dashboard-premium-stat.economy-stat {
  position: relative;
  padding: 14px 34px 13px 78px;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-stat-top {
  min-height: 20px;
  display: block;
  position: relative;
  z-index: 4;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-icon {
  display: none;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-stat-title {
  display: block;
  margin: 0;
  font-size: 12px;
  line-height: 1.1;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-value {
  display: block;
  font-size: 19px;
  line-height: 1.05;
  margin-top: 7px;
  padding: 0;
  white-space: nowrap;
  position: relative;
  z-index: 4;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-bottom {
  display: block;
  margin-top: 5px;
  padding: 0;
  min-height: 0;
  position: relative;
  z-index: 4;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-subtitle {
  display: block;
  color: #e7edf1;
  font-size: 9px;
  line-height: 1.2;
  white-space: nowrap;
}

.dashboard-premium-stat.economy-stat .economy-saved-label {
  display: block;
  margin-top: 3px;
  color: rgba(224,232,239,.55);
  font-size: 8px;
  line-height: 1.15;
  white-space: nowrap;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-ring {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 55px;
  height: 55px;
  margin: 0;
  border-radius: 50%;
  z-index: 2;
  font-size: 11px;
  color: #ecfff4;
  background:
    radial-gradient(circle at center, #121b20 58%, transparent 60%),
    conic-gradient(#55f49a 0 var(--economy-progress, 53%), rgba(85,244,154,.11) var(--economy-progress, 53%) 100%);
  box-shadow:
    0 0 20px rgba(85,244,154,.12),
    inset 0 0 8px rgba(85,244,154,.045);
}

.dashboard-premium-stat.economy-stat .dashboard-premium-ring::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
  pointer-events: none;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-spark {
  position: absolute;
  top: auto;
  right: 30px;
  bottom: 0;
  left: auto;
  width: 62px;
  height: 23px;
  margin: 0;
  padding: 0;
  transform: none;
  opacity: .85;
  z-index: 1;
}

.dashboard-premium-stat.economy-stat .economy-arrow {
  right: 8px;
  top: 50%;
  width: 22px;
  height: 28px;
  font-size: 25px;
  color: rgba(218,226,233,.72);
  z-index: 5;
}

.dashboard-premium-stat.economy-stat .economy-arrow:hover {
  color: #55f49a;
}

/* ===== AJUSTE FINAL: ECONOMIA ALINHADA AOS OUTROS CARDS ===== */
.dashboard-premium-stat.economy-stat {
  position: relative !important;
  box-sizing: border-box !important;
  padding: 14px 46px 13px 18px !important;
  overflow: hidden !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-stat-top {
  position: relative !important;
  display: block !important;
  min-height: 20px !important;
  padding: 0 !important;
  margin: 0 !important;
  z-index: 4 !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-stat-title {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 12px !important;
  line-height: 1.1 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-icon {
  display: none !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-ring {
  position: absolute !important;
  top: 10px !important;
  right: 42px !important;
  left: auto !important;
  transform: none !important;
  width: 54px !important;
  height: 54px !important;
  margin: 0 !important;
  z-index: 3 !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-value {
  position: relative !important;
  display: block !important;
  margin: 7px 0 0 !important;
  padding: 0 !important;
  font-size: 20px !important;
  line-height: 1.05 !important;
  white-space: nowrap !important;
  z-index: 4 !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-bottom {
  position: relative !important;
  display: block !important;
  margin: 6px 0 0 !important;
  padding: 0 !important;
  min-height: 0 !important;
  z-index: 4 !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-subtitle {
  display: block !important;
  margin: 0 !important;
  font-size: 9px !important;
  line-height: 1.2 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .economy-saved-label {
  display: block !important;
  margin-top: 3px !important;
  font-size: 8px !important;
  line-height: 1.15 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-spark {
  position: absolute !important;
  top: auto !important;
  right: 42px !important;
  bottom: 7px !important;
  left: auto !important;
  width: 72px !important;
  height: 22px !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
  z-index: 2 !important;
  pointer-events: none !important;
}

.dashboard-premium-stat.economy-stat .economy-arrow {
  position: absolute !important;
  right: 9px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 8 !important;
}

/* ===== FIM DO AJUSTE FINAL ===== */

/* Evita qualquer aparência lavada no tema claro. */
.app:not(.dark) .dashboard-premium-stat {
  background:
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(246,249,252,.96)),
    #fff;
  border-color: rgba(100,116,139,.13);
  box-shadow:
    0 12px 30px rgba(31,41,55,.07),
    inset 0 1px 0 rgba(255,255,255,.95);
}

@media (max-width: 1050px) {
  .dashboard-premium-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 580px) {
  .dashboard-premium-stats {
    grid-template-columns: 1fr;
  }

  .dashboard-premium-stat {
    height: 118px;
    min-height: 118px;
  }
}



.economy-stat {
  position: relative !important;
}

.economy-stat .dashboard-premium-spark {
  position: absolute !important;
  right: 42px !important;
  bottom: 9px !important;
  top: auto !important;
  left: auto !important;
  width: 74px !important;
  height: 23px !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
  flex: none !important;
  z-index: 1 !important;
}


/* ===== ECONOMIA — AJUSTE VISUAL FINAL ===== */
.dashboard-premium-stat.economy-stat {
  position: relative !important;
  box-sizing: border-box !important;
  padding: 14px 48px 13px 18px !important;
  min-width: 0 !important;
  overflow: hidden !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-stat-top {
  display: block !important;
  position: relative !important;
  min-height: 20px !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 4 !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-icon {
  display: none !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-stat-title {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 10px !important;
  line-height: 1.2 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-ring {
  position: absolute !important;
  top: 10px !important;
  right: 42px !important;
  left: auto !important;
  transform: none !important;
  width: 54px !important;
  height: 54px !important;
  margin: 0 !important;
  z-index: 3 !important;
  font-size: 11px !important;
  display: grid !important;
  place-items: center !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-value {
  display: block !important;
  position: relative !important;
  z-index: 4 !important;
  margin: 7px 0 0 !important;
  padding: 0 !important;
  max-width: calc(100% - 76px) !important;
  font-size: 20px !important;
  line-height: 1.05 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-bottom {
  display: block !important;
  position: static !important;
  z-index: 4 !important;
  margin: 6px 0 0 !important;
  padding: 0 !important;
  min-height: 0 !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-subtitle {
  display: block !important;
  margin: 0 !important;
  font-size: 9px !important;
  line-height: 1.2 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .economy-saved-label {
  display: block !important;
  margin-top: 3px !important;
  font-size: 8px !important;
  line-height: 1.15 !important;
  white-space: nowrap !important;
}

.dashboard-premium-stat.economy-stat .dashboard-premium-spark {
  position: absolute !important;
  top: auto !important;
  right: 42px !important;
  bottom: 8px !important;
  left: auto !important;
  width: 74px !important;
  height: 23px !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
  flex: none !important;
  z-index: 1 !important;
  pointer-events: none !important;
}

.dashboard-premium-stat.economy-stat .economy-arrow {
  position: absolute !important;
  top: 50% !important;
  right: 9px !important;
  transform: translateY(-50%) !important;
  z-index: 8 !important;
}


/* =========================================================
   TEMA CLARO — CONTRASTE E LEGIBILIDADE
   Não altera o tema escuro.
   ========================================================= */

.app:not(.dark) {
  --bg: #f5f7fa;
  --sidebar: #ffffff;
  --panel: #ffffff;
  --panel-2: #f8fafc;
  --text: #182230;
  --muted: #5f6d7e;
  --border: #d7e0e9;
  --hover: #edf3f7;
  --shadow: 0 12px 35px rgba(31, 41, 55, .08);
}

.app:not(.dark) .dashboard-premium-stat,
.app:not(.dark) .panel,
.app:not(.dark) .stat-card,
.app:not(.dark) .chart-panel,
.app:not(.dark) .category-panel,
.app:not(.dark) .table-panel,
.app:not(.dark) .card,
.app:not(.dark) .modal {
  border-color: #d7e0e9 !important;
  box-shadow:
    0 10px 28px rgba(31, 41, 55, .07),
    inset 0 1px 0 rgba(255,255,255,.9) !important;
}

.app:not(.dark) .dashboard-premium-stat {
  background:
    radial-gradient(circle at 85% 110%, rgba(32,201,120,.07), transparent 48%),
    #ffffff !important;
}

.app:not(.dark) .dashboard-premium-stat-title,
.app:not(.dark) .dashboard-premium-subtitle,
.app:not(.dark) .dashboard-premium-trend small,
.app:not(.dark) .panel-subtitle,
.app:not(.dark) .eyebrow,
.app:not(.dark) .muted,
.app:not(.dark) .helper,
.app:not(.dark) .form-help {
  color: #536273 !important;
}

.app:not(.dark) .dashboard-premium-stat.green .dashboard-premium-value {
  color: #16a765 !important;
}

.app:not(.dark) .dashboard-premium-stat.red .dashboard-premium-value {
  color: #e54858 !important;
}

.app:not(.dark) .dashboard-premium-stat.blue .dashboard-premium-value {
  color: #2476d8 !important;
}

.app:not(.dark) .dashboard-premium-stat.green .dashboard-premium-trend {
  color: #12995b !important;
}

.app:not(.dark) .dashboard-premium-stat.red .dashboard-premium-trend {
  color: #d83d4d !important;
}

.app:not(.dark) .dashboard-premium-stat.blue .dashboard-premium-trend {
  color: #2476d8 !important;
}

.app:not(.dark) .dashboard-premium-spark {
  opacity: 1 !important;
}

.app:not(.dark) .dashboard-premium-stat.green .dashboard-premium-spark {
  color: #16b86d !important;
}

.app:not(.dark) .dashboard-premium-stat.red .dashboard-premium-spark {
  color: #ed5363 !important;
}

.app:not(.dark) .dashboard-premium-stat.blue .dashboard-premium-spark {
  color: #3284e4 !important;
}

.app:not(.dark) .dashboard-premium-ring {
  color: #233142 !important;
  background:
    radial-gradient(circle at center, #ffffff 58%, transparent 60%),
    conic-gradient(#16b86d 0 var(--economy-progress, 53%), #dce7e0 var(--economy-progress, 53%) 100%) !important;
}

.app:not(.dark) .sidebar {
  background: #ffffff !important;
  border-right-color: #d7e0e9 !important;
}

.app:not(.dark) .nav-item {
  color: #344254 !important;
}

.app:not(.dark) .nav-item:hover,
.app:not(.dark) .nav-item.active {
  color: #11985b !important;
}

.app:not(.dark) .nav-item.active {
  background: rgba(22,184,109,.10) !important;
}

.app:not(.dark) .menu-label,
.app:not(.dark) .brand span {
  color: #667486 !important;
}

.app:not(.dark) .page-heading h1,
.app:not(.dark) h1,
.app:not(.dark) h2,
.app:not(.dark) h3,
.app:not(.dark) strong {
  color: #182230;
}

.app:not(.dark) .btn.secondary,
.app:not(.dark) .btn.ghost,
.app:not(.dark) .month-select,
.app:not(.dark) .select,
.app:not(.dark) input,
.app:not(.dark) textarea,
.app:not(.dark) select {
  color: #263445 !important;
  background: #ffffff !important;
  border-color: #cfd9e4 !important;
}

.app:not(.dark) input::placeholder,
.app:not(.dark) textarea::placeholder {
  color: #7a8796 !important;
}

.app:not(.dark) .btn.secondary:hover,
.app:not(.dark) .btn.ghost:hover,
.app:not(.dark) .month-select:hover {
  background: #f0f4f8 !important;
}

.app:not(.dark) .table th,
.app:not(.dark) .table td,
.app:not(.dark) .investment-row,
.app:not(.dark) .bill-row,
.app:not(.dark) .transaction-row {
  border-color: #dfe6ed !important;
}

.app:not(.dark) .table th,
.app:not(.dark) .list-subtitle,
.app:not(.dark) .investment-row span,
.app:not(.dark) .bill-row span {
  color: #5b6979 !important;
}

/* Popovers/tooltips ficam acima dos cards e com contraste real no tema claro. */
.app:not(.dark) .nav-hover-info,
.app:not(.dark) .popover,
.app:not(.dark) .tooltip,
.app:not(.dark) .dropdown,
.app:not(.dark) .modal {
  background: #ffffff !important;
  color: #182230 !important;
  border-color: #d4dee8 !important;
  box-shadow: 0 18px 42px rgba(31,41,55,.14) !important;
}

/* Ícones coloridos continuam fortes, mas o fundo não fica lavado. */
.app:not(.dark) .dashboard-premium-icon.green {
  color: #07351f !important;
}

.app:not(.dark) .dashboard-premium-icon.red,
.app:not(.dark) .dashboard-premium-icon.blue {
  color: #ffffff !important;
}

`;

function StyleInjector() {
  return <style dangerouslySetInnerHTML={{ __html: style }} />;
}

/*
  O style precisa existir no documento.
  O componente abaixo é executado automaticamente pelo Next.
*/

if (typeof document !== "undefined") {
  const id = "meu-financeiro-pro-style";

  if (!document.getElementById(id)) {
    const styleElement = document.createElement("style");
    styleElement.id = id;
    styleElement.textContent = style;
    document.head.appendChild(styleElement);
  }
}