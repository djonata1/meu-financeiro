"use client";

import { supabase } from "@/utils/client";

import {
  FormEvent,
  ReactNode,
  useEffect,
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

const STORAGE = {
  theme: "meu-financeiro-theme",
  transactions: "meu-financeiro-transactions",
  bills: "meu-financeiro-bills",
  cards: "meu-financeiro-cards",
  purchases: "meu-financeiro-purchases",
  goals: "meu-financeiro-goals",
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

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateBR(date: string) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
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
}: {
  dark: boolean;
  interactive?: boolean;
}) {
  const [activePoint, setActivePoint] = useState<number | null>(null);

  const greenCoords = [
    [0, 115],
    [35, 102],
    [70, 108],
    [105, 82],
    [140, 91],
    [175, 57],
    [210, 72],
    [245, 42],
    [280, 53],
    [315, 30],
    [350, 50],
    [385, 35],
    [420, 46],
    [455, 25],
  ];

  const redCoords = [
    [0, 137],
    [35, 127],
    [70, 132],
    [105, 115],
    [140, 123],
    [175, 93],
    [210, 103],
    [245, 77],
    [280, 94],
    [315, 68],
    [350, 82],
    [385, 67],
    [420, 79],
    [455, 61],
  ];

  // Valores usados apenas para o tooltip do gráfico.
  // O desenho do gráfico permanece exatamente no mesmo formato visual.
  const greenValues = [
    2200, 2350, 2280, 2500, 2450, 2650, 2580,
    2780, 2700, 2900, 2820, 3000, 2920, 2800,
  ];

  const redValues = [
    1200, 1350, 1280, 1450, 1400, 1550, 1480,
    1680, 1600, 1780, 1700, 1850, 1760, 1811.7,
  ];

  const greenPoints = greenCoords.map(([x, y]) => `${x},${y}`).join(" ");
  const redPoints = redCoords.map(([x, y]) => `${x},${y}`).join(" ");

  const tooltipIndex = activePoint ?? 0;
  const tooltipX = greenCoords[tooltipIndex]?.[0] ?? 0;
  const tooltipY = Math.min(
    greenCoords[tooltipIndex]?.[1] ?? 0,
    redCoords[tooltipIndex]?.[1] ?? 0
  );

  return (
    <div className="mini-chart-wrap">
      <svg
        width="100%"
        height="230"
        viewBox="0 0 455 150"
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
          <linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity=".25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="redFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity=".18" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[25, 55, 85, 115].map((y) => (
          <line
            key={y}
            x1="0"
            x2="455"
            y1={y}
            y2={y}
            stroke={dark ? "#263247" : "#e8edf4"}
            strokeWidth="1"
          />
        ))}

        <polyline
          points={`${greenPoints} 455,150 0,150`}
          fill="url(#greenFill)"
          stroke="none"
        />

        <polyline
          points={greenPoints}
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <polyline
          points={redPoints}
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {interactive &&
          greenCoords.map(([x, y], index) => (
            <g key={`point-${index}`}>
              <circle
                cx={x}
                cy={y}
                r="10"
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") {
                    setActivePoint(index);
                  }
                }}
                onPointerMove={() => setActivePoint(index)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setActivePoint(index);
                }}
              />

              {activePoint === index && (
                <>
                  <line
                    x1={x}
                    x2={x}
                    y1="18"
                    y2="142"
                    stroke={dark ? "#52637c" : "#cbd5e1"}
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    pointerEvents="none"
                  />

                  <circle
                    cx={x}
                    cy={y}
                    r="5.5"
                    fill="#22c55e"
                    stroke={dark ? "#101a29" : "white"}
                    strokeWidth="2"
                    pointerEvents="none"
                  />

                  <circle
                    cx={redCoords[index][0]}
                    cy={redCoords[index][1]}
                    r="5.5"
                    fill="#ef4444"
                    stroke={dark ? "#101a29" : "white"}
                    strokeWidth="2"
                    pointerEvents="none"
                  />
                </>
              )}
            </g>
          ))}

        {interactive && activePoint !== null && (
          <g
            transform={`translate(${Math.min(
              Math.max(tooltipX - 72, 5),
              300
            )}, ${Math.max(tooltipY - 78, 5)})`}
            pointerEvents="none"
          >
            <rect
              width="150"
              height="68"
              rx="9"
              fill={dark ? "#0c1a2b" : "#ffffff"}
              stroke={dark ? "#30445f" : "#d9e1eb"}
              strokeWidth="1"
            />

            <text
              x="12"
              y="19"
              fill={dark ? "#9aa9bc" : "#64748b"}
              fontSize="9"
              fontWeight="600"
            >
              Fluxo financeiro
            </text>

            <text
              x="12"
              y="38"
              fill="#22c55e"
              fontSize="10"
              fontWeight="800"
            >
              Entradas: {money(greenValues[activePoint])}
            </text>

            <text
              x="12"
              y="56"
              fill="#ef4444"
              fontSize="10"
              fontWeight="800"
            >
              Gastos: {money(redValues[activePoint])}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function DonutChart() {
  return (
    <div className="donut-wrap">
      <div className="donut">
        <div className="donut-center">
          <strong>R$ 3.740</strong>
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
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [purchases, setPurchases] =
    useState<CardPurchase[]>(initialPurchases);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);

  const [modal, setModal] = useState<
    "transaction" | "bill" | "purchase" | "goal" | "card" | null
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

  const [cardForm, setCardForm] = useState({
    name: "",
    brand: "VISA",
    last4: "",
    limit: "",
    closingDay: "2",
    dueDay: "10",
  });

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
      setTransactions((data.transactions as Transaction[]) || []);
      setBills((data.bills as Bill[]) || []);
      setCards((data.cards as Card[]) || []);
      setPurchases((data.purchases as CardPurchase[]) || []);
      setGoals((data.goals as Goal[]) || []);
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

 async function updateCloud(patch: Record<string, unknown>) {
  if (!user?.id) return;

  setSavingCloud(true);
  setCloudError("");

  try {
    const { error } = await supabase
      .from("financeiro_user_data")
      .upsert(
        {
          user_id: user.id,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error("Erro ao salvar dados:", error);
      setCloudError(
        "Não foi possível salvar uma alteração. Verifique sua conexão."
      );
    }
  } catch (error) {
    console.error("Erro inesperado ao salvar:", error);
    setCloudError(
      "Não foi possível salvar uma alteração. Verifique sua conexão."
    );
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

  const dark = theme === "dark";

  const income = useMemo(
    () =>
      transactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0),
    [transactions]
  );

  const expenses = useMemo(
    () =>
      transactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0),
    [transactions]
  );

  const balance = income - expenses + 1460;

  const pendingBills = useMemo(
    () =>
      bills
        .filter((bill) => !bill.paid)
        .reduce((sum, bill) => sum + bill.amount, 0),
    [bills]
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

  const filteredTransactions = transactions
    .filter((transaction) =>
      `${transaction.description} ${transaction.category} ${transaction.account}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  function navigate(nextPage: Page) {
    setPage(nextPage);
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

  function addCard(e: FormEvent) {
    e.preventDefault();

    const limit = Number(cardForm.limit.replace(",", "."));

    if (!cardForm.name || !limit) return;

    const card: Card = {
      id: Date.now(),
      name: cardForm.name,
      brand: cardForm.brand,
      last4: cardForm.last4,
      limit,
      closingDay: Number(cardForm.closingDay),
      dueDay: Number(cardForm.dueDay),
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

  function addToGoal(goal: Goal) {
    const value = window.prompt(
      `Quanto deseja adicionar à meta "${goal.name}"?`
    );

    if (!value) return;

    const amount = Number(value.replace(",", "."));

    if (!amount) return;

    setGoals((current) =>
      current.map((item) =>
        item.id === goal.id
          ? {
              ...item,
              current: Math.min(item.target, item.current + amount),
            }
          : item
      )
    );
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
      <aside className="sidebar">
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
          />

          <NavItem
            active={page === "reports"}
            icon="chart"
            label="Relatórios"
            onClick={() => navigate("reports")}
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
              transactions={transactions}
              bills={bills}
              cards={cards}
              purchases={purchases}
              goals={goals}
              userName={displayName}
              onNew={() => setModal("transaction")}
              onTransactions={() => navigate("transactions")}
              onBills={() => navigate("bills")}
              onCards={() => navigate("cards")}
              onGoals={() => navigate("goals")}
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
              bills={bills}
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
            />
          )}

          {page === "goals" && (
            <GoalsPage
              dark={dark}
              goals={goals}
              onNew={() => setModal("goal")}
              onAdd={addToGoal}
              onDelete={deleteGoal}
            />
          )}

          {page === "investments" && (
            <InvestmentsPage dark={dark} />
          )}

          {page === "reports" && (
            <ReportsPage
              dark={dark}
              income={income}
              expenses={expenses}
              transactions={transactions}
            />
          )}

          {page === "settings" && (
            <SettingsPage
              dark={dark}
              theme={theme}
              setTheme={setTheme}
            />
          )}
        </div>
      </section>

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

      {modal === "goal" && (
        <Modal
          title="Nova meta financeira"
          onClose={() => setModal(null)}
          dark={dark}
        >
          <form onSubmit={addGoal}>
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
                Criar meta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "card" && (
        <Modal
          title="Adicionar cartão"
          onClose={() => setModal(null)}
          dark={dark}
        >
          <form onSubmit={addCard}>
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

              <Field
                label="Fechamento"
                value={cardForm.closingDay}
                type="number"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    closingDay: value,
                  }))
                }
                dark={dark}
              />

              <Field
                label="Vencimento"
                value={cardForm.dueDay}
                type="number"
                onChange={(value) =>
                  setCardForm((current) => ({
                    ...current,
                    dueDay: value,
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
                Adicionar cartão
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
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "nav-item active" : "nav-item"}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </button>
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
}) {
  const economy =
    income > 0
      ? Math.max(0, Math.round(((income - expenses) / income) * 100))
      : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VISÃO GERAL / AGOSTO 2026</p>
          <h1>Olá, {userName}! 👋</h1>
          <p>Aqui está o resumo das suas finanças.</p>
        </div>

        <div className="heading-actions">
          <button className="period">
            Agosto 2026
            <span>⌄</span>
          </button>

          <button className="btn primary" onClick={onNew}>
            <Icon name="plus" size={17} />
            Nova movimentação
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Saldo atual"
          value={money(balance)}
          subtitle="+8,4% em relação a Julho"
          icon="wallet"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Entradas"
          value={money(income)}
          subtitle="Receitas deste mês"
          icon="arrowDown"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Gastos"
          value={money(expenses)}
          subtitle="Despesas deste mês"
          icon="arrowUp"
          type="red"
          dark={dark}
        />

        <StatCard
          title="Disponível no mês"
          value={money(Math.max(0, income - expenses))}
          subtitle={`${economy}% de economia`}
          icon="card"
          type="blue"
          dark={dark}
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

          <MiniChart dark={dark} interactive />

          <div className="chart-days">
            <span>01 Ago</span>
            <span>08 Ago</span>
            <span>15 Ago</span>
            <span>22 Ago</span>
            <span>29 Ago</span>
          </div>
        </section>

        <section className="panel category-panel">
          <PanelHeader
            title="Gastos por categoria"
            subtitle="Onde seu dinheiro está indo"
          />

          <div className="category-content">
            <DonutChart />

            <div className="category-list">
              <CategoryLine
                label="Casa"
                value={1500}
                percent={40}
                color="green"
              />

              <CategoryLine
                label="Alimentação"
                value={620}
                percent={17}
                color="blue"
              />

              <CategoryLine
                label="Transporte"
                value={400}
                percent={11}
                color="orange"
              />

              <CategoryLine
                label="Lazer"
                value={340}
                percent={9}
                color="purple"
              />

              <CategoryLine
                label="Assinaturas"
                value={280}
                percent={7}
                color="pink"
              />

              <CategoryLine
                label="Outros"
                value={600}
                percent={16}
                color="gray"
              />
            </div>
          </div>

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
            {bills.slice(0, 4).map((bill) => (
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
}: {
  dark: boolean;
  cards: Card[];
  purchases: CardPurchase[];
  selectedCard: number;
  setSelectedCard: (id: number) => void;
  onNewCard: () => void;
  onNewPurchase: () => void;
  onDeletePurchase: (id: number) => void;
}) {
  const card = cards.find((item) => item.id === selectedCard);

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
                <button
                  key={item.id}
                  className={
                    selectedCard === item.id
                      ? "credit-card selected"
                      : "credit-card"
                  }
                  onClick={() => setSelectedCard(item.id)}
                >
                  <div className="credit-card-top">
                    <span>{item.name}</span>
                    <strong>{item.brand}</strong>
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
                </button>
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
  onDelete,
}: {
  dark: boolean;
  goals: Goal[];
  onNew: () => void;
  onAdd: (goal: Goal) => void;
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

                <button
                  className="delete-button"
                  onClick={() => onDelete(goal.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
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

function InvestmentsPage({ dark }: { dark: boolean }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PATRIMÔNIO</p>
          <h1>Investimentos</h1>
          <p>Acompanhe a evolução do seu patrimônio.</p>
        </div>

        <button className="btn primary">
          <Icon name="plus" size={17} />
          Novo investimento
        </button>
      </div>

      <div className="stats-grid three">
        <StatCard
          title="Patrimônio investido"
          value="R$ 8.450,00"
          subtitle="+12,4% este ano"
          icon="chart"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Rendimento"
          value="R$ 930,00"
          subtitle="Lucro acumulado"
          icon="arrowUp"
          type="green"
          dark={dark}
        />

        <StatCard
          title="Rentabilidade"
          value="12,38%"
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
            subtitle="Últimos 12 meses"
          />

          <MiniChart dark={dark} />
        </section>

        <section className="panel">
          <PanelHeader
            title="Distribuição"
            subtitle="Onde seu patrimônio está"
          />

          <div className="investment-list">
            <InvestmentRow
              name="Bitcoin"
              value="R$ 2.500,00"
              percent="29,6%"
            />

            <InvestmentRow
              name="Ethereum"
              value="R$ 1.800,00"
              percent="21,3%"
            />

            <InvestmentRow
              name="Renda fixa"
              value="R$ 2.650,00"
              percent="31,4%"
            />

            <InvestmentRow
              name="Ações"
              value="R$ 1.500,00"
              percent="17,7%"
            />
          </div>
        </section>
      </div>
    </>
  );
}

function InvestmentRow({
  name,
  value,
  percent,
}: {
  name: string;
  value: string;
  percent: string;
}) {
  return (
    <div className="investment-row">
      <div className="investment-icon">
        {name === "Bitcoin"
          ? "₿"
          : name === "Ethereum"
          ? "◆"
          : name === "Ações"
          ? "↗"
          : "R$"}
      </div>

      <div>
        <strong>{name}</strong>
        <span>{percent} da carteira</span>
      </div>

      <strong>{value}</strong>
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
}: {
  dark: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
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
  --green: #20c978;
  --green-dark: #16a765;
  --red: #ef5360;
  --blue: #4f8cff;
  --orange: #f59e0b;
  --purple: #8b5cf6;
  --pink: #ec4899;
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
  --bg: #f5f7fb;
  --sidebar: #ffffff;
  --panel: #ffffff;
  --panel-2: #f8fafc;
  --text: #18212f;
  --muted: #8490a3;
  --border: #e7ebf2;
  --hover: #f2f5f8;
  --shadow: 0 12px 35px rgba(31, 41, 55, .055);

  min-height: 100vh;
  display: flex;
  background: var(--bg);
  color: var(--text);
}

.app.dark {
  --bg: #080e18;
  --sidebar: #0c1420;
  --panel: #101a29;
  --panel-2: #0c1522;
  --text: #edf3fa;
  --muted: #7e8da2;
  --border: #1d2a3b;
  --hover: #152132;
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
  background: linear-gradient(135deg, #27d987, #16ad6c);
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

.stat-card,
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  border-radius: 11px;
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
  background: #20c978;
}

.dot.red {
  background: #ef5360;
}

.dot.blue {
  background: #4f8cff;
}

.dot.orange {
  background: #f59e0b;
}

.dot.purple {
  background: #8b5cf6;
}

.dot.pink {
  background: #ec4899;
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
      #20c978 0 40%,
      #4f8cff 40% 57%,
      #f59e0b 57% 68%,
      #8b5cf6 68% 77%,
      #ec4899 77% 84%,
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
  background: linear-gradient(90deg, #20c978, #48df91);
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

.credit-card:hover,
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
  grid-template-columns: 36px 1fr auto;
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
  color: #18212f;
  border-radius: 16px;
  padding: 21px;
  box-shadow: 0 30px 90px rgba(0,0,0,.25);
}

.modal-dark {
  background: #101a29;
  color: #edf3fa;
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
  color: #8490a3;
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
  color: #18212f;
  padding: 0 10px;
  outline: none;
  font-size: 10px;
}

.input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(32,201,120,.08);
}

.input-dark {
  background: #0c1522;
  border-color: #263449;
  color: #edf3fa;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 21px;
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
    display: none;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
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

  .form-grid {
    grid-template-columns: 1fr;
  }

  .invoice-header {
    flex-direction: column;
  }

  .invoice-value {
    text-align: left;
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