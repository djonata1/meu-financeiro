// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";
import { supabase } from "@/utils/client";
import {
  LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, TrendingUp, Target,
  BarChart3, Calculator as CalcIcon, Tags, Settings as SettingsIcon, Menu, X,
  Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Sun, Moon, Check,
  Eye, EyeOff,
  ChevronRight, ChevronLeft, Wallet, Download, AlertCircle, Search, Filter,
  ArrowRightLeft, Delete, Divide, CalendarDays
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LineChart, Line, Legend
} from "recharts";

/* =========================================================================
   MEU FINANCEIRO — utilitários, storage e tipos
   ========================================================================= */

const STORAGE_KEY = "meu-financeiro:v1";
const LOCAL_CACHE_KEY = "meu-financeiro:cache:v2";

const occurrenceKey = (fixedAccountId, monthKey) => `${fixedAccountId}:${monthKey}`;

const safeString = (v) => typeof v === "string" ? v : v == null ? "" : String(v);
const safeCents = (v) => Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0;

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dueDateForMonth(monthKey, dueDay) {
  const [y, m] = monthKey.split("-").map(Number);
  const day = Math.min(Math.max(1, Number(dueDay) || 1), daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fixedTemplateFromBill(b) {
  const dueDay = Number(safeString(b?.dueDate).slice(8, 10)) || 1;
  return {
    id: b.fixedAccountId || `fixed-${b.id}`,
    name: safeString(b.name) || "Conta fixa",
    valueCents: safeCents(b.valueCents),
    dueDay,
    categoryId: b.categoryId || "cat-recorrente",
    accountId: b.accountId || "",
    recurrence: b.recurrence === "yearly" ? "yearly" : "monthly",
    startDate: b.startDate || b.dueDate || isoToday(),
    active: true,
  };
}

function normalizeState(raw) {
  const base = seedData();
  const d = raw && typeof raw === "object" ? raw : {};
  const transactions = Array.isArray(d.transactions) ? d.transactions : [];
  const oldBills = Array.isArray(d.bills) ? d.bills : [];

  const fixedAccounts = Array.isArray(d.fixedAccounts)
    ? d.fixedAccounts.map((f) => ({
        id: f.id || uid(),
        name: safeString(f.name) || "Conta fixa",
        valueCents: safeCents(f.valueCents),
        dueDay: Number(f.dueDay) || Number(safeString(f.dueDate).slice(8, 10)) || 1,
        categoryId: f.categoryId || "cat-recorrente",
        accountId: f.accountId || "",
        recurrence: f.recurrence === "yearly" ? "yearly" : "monthly",
        startDate: f.startDate || f.dueDate || isoToday(),
        active: f.active !== false,
      }))
    : [];

  const fixedIds = new Set(fixedAccounts.map((f) => f.id));

  // Migração compatível: contas fixas antigas continuam funcionando,
  // mas passam a ter uma única ocorrência identificada por mês.
  const bills = oldBills.map((b) => {
    const fixed = !!(b.fixed || b.recurrence === "monthly" || b.recurrence === "yearly" || b.fixedAccountId);
    const fixedAccountId = fixed ? (b.fixedAccountId || `fixed-${b.id}`) : null;
    const mk = monthKeyOf(b.dueDate || isoToday());
    return {
      ...b,
      id: b.id || uid(),
      name: safeString(b.name) || "Conta",
      valueCents: safeCents(b.valueCents),
      dueDate: b.dueDate || isoToday(),
      categoryId: b.categoryId || "cat-recorrente",
      accountId: b.accountId || "",
      status: b.status === "paid" ? "paid" : "pending",
      fixed,
      recurrence: fixed ? (b.recurrence === "yearly" ? "yearly" : "monthly") : "none",
      fixedAccountId,
      occurrenceKey: fixedAccountId ? (b.occurrenceKey || occurrenceKey(fixedAccountId, mk)) : null,
      paidDate: b.paidDate || null,
      paymentId: b.paymentId || b.paidTransactionId || null,
      paymentAccountId: b.paymentAccountId || b.accountId || "",
      paidTransactionId: null,
    };
  });

  for (const b of bills) {
    if (b.fixed && b.fixedAccountId && !fixedIds.has(b.fixedAccountId)) {
      fixedAccounts.push(fixedTemplateFromBill(b));
      fixedIds.add(b.fixedAccountId);
    }
  }

  // Regra estrutural: uma conta fixa só pode ter uma ocorrência por mês.
  // Se existirem duplicatas antigas, preservamos a paga; caso contrário,
  // preservamos a primeira ocorrência encontrada.
  const occurrenceMap = new Map();
  for (const b of bills) {
    if (!b.fixed || !b.occurrenceKey) continue;
    const previous = occurrenceMap.get(b.occurrenceKey);
    if (!previous || (b.status === "paid" && previous.status !== "paid")) {
      occurrenceMap.set(b.occurrenceKey, b);
    }
  }
  const cleanedBills = bills.filter((b) => {
    if (!b.fixed || !b.occurrenceKey) return true;
    return occurrenceMap.get(b.occurrenceKey)?.id === b.id;
  });

  // Transações geradas automaticamente por contas antigas não são mais
  // usadas: o pagamento da conta é representado pelo status da ocorrência.
  const linkedPaymentIds = new Set(oldBills.map((b) => b.paidTransactionId).filter(Boolean));
  const invoicePayments = d.invoicePayments && typeof d.invoicePayments === "object" ? d.invoicePayments : {};
  const invoiceTxIds = new Set(Object.values(invoicePayments).map((p) => p?.transactionId).filter(Boolean));

  // Faturas são o único fluxo que cria uma transação de pagamento.
  // Cada invoicePaymentKey pode ter exatamente uma transação.
  const seenInvoiceKeys = new Set();
  const cleanedTransactions = transactions.filter((t) => {
    if (linkedPaymentIds.has(t.id) || t.sourceBillId || t.sourceBillOccurrenceId) return false;
    if (t.invoicePaymentKey) {
      const expectedId = invoicePayments[t.invoicePaymentKey]?.transactionId;
      if (!expectedId || expectedId !== t.id || seenInvoiceKeys.has(t.invoicePaymentKey)) return false;
      seenInvoiceKeys.add(t.invoicePaymentKey);
    }
    return true;
  });

  return {
    ...base,
    ...d,
    categories: Array.isArray(d.categories) && d.categories.length ? d.categories : base.categories,
    accounts: Array.isArray(d.accounts) ? d.accounts : [],
    cards: Array.isArray(d.cards) ? d.cards : [],
    transactions: cleanedTransactions,
    bills: cleanedBills,
    fixedAccounts,
    cardPurchases: Array.isArray(d.cardPurchases) ? d.cardPurchases : [],
    invoicePayments,
    recurringReceipts: Array.isArray(d.recurringReceipts) ? d.recurringReceipts : [],
    investments: Array.isArray(d.investments) ? d.investments : [],
    goals: Array.isArray(d.goals) ? d.goals : [],
    settings: {
      theme: d.settings?.theme === "light" ? "light" : "dark",
      activeMonth: d.settings?.activeMonth || isoToday().slice(0, 7),
      closedMonths: Array.isArray(d.settings?.closedMonths) ? d.settings.closedMonths : [],
    },
  };
}

function ensureFixedOccurrences(state, monthKey = isoToday().slice(0, 7)) {
  const next = normalizeState(state);

  // Remove ocorrências geradas para meses anteriores ao "Começar em".
  // Isso evita que uma conta cadastrada para 05/10 continue aparecendo
  // no dashboard de setembro por causa de uma ocorrência antiga.
  const fixedById = new Map((next.fixedAccounts || []).map((f) => [f.id, f]));
  const bills = next.bills.filter((b) => {
    if (!b.fixed || !b.fixedAccountId) return true;
    const f = fixedById.get(b.fixedAccountId);
    if (!f) return true;
    return monthKeyOf(b.dueDate) >= monthKeyOf(f.startDate || b.dueDate);
  });

  const existing = new Set(
    bills.filter((b) => b.fixed && b.occurrenceKey).map((b) => b.occurrenceKey)
  );

  for (const f of next.fixedAccounts || []) {
    if (f.active === false) continue;
    const startDate = safeString(f.startDate || isoToday());
    const startMonth = monthKeyOf(startDate);

    // "Começar em" é a primeira cobrança real.
    // Ex.: começar em 05/10 + vencimento dia 5:
    // setembro não recebe ocorrência; outubro recebe 05/10.
    if (monthKey < startMonth) continue;
    if (f.recurrence === "yearly" && monthKey.slice(5) !== startMonth.slice(5)) continue;

    const startDay = Number(startDate.slice(8, 10)) || Number(f.dueDay) || 1;
    const occurrenceDay = monthKey === startMonth ? startDay : Number(f.dueDay) || 1;
    const key = occurrenceKey(f.id, monthKey);
    if (existing.has(key)) continue;

    bills.push({
      id: uid(),
      name: f.name,
      valueCents: safeCents(f.valueCents),
      dueDate: dueDateForMonth(monthKey, occurrenceDay),
      categoryId: f.categoryId,
      accountId: f.accountId,
      status: "pending",
      fixed: true,
      recurrence: f.recurrence,
      fixedAccountId: f.id,
      occurrenceKey: key,
      paidDate: null,
      paymentId: null,
      paymentAccountId: f.accountId || "",
      paidTransactionId: null,
    });
    existing.add(key);
  }

  return { ...next, bills };
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());

const toCents = (v) => Math.round((parseFloat(String(v).replace(",", ".")) || 0) * 100);

const brl = (cents, { sign = false } = {}) => {
  const n = (cents || 0) / 100;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (sign) return (n > 0 ? "+" : n < 0 ? "-" : "") + formatted;
  return (n < 0 ? "-" : "") + formatted;
};

const pct = (n, digits = 2) => {
  const v = Number.isFinite(n) ? n : 0;
  const s = v.toFixed(digits).replace(".", ",");
  return (v > 0 ? "+" : "") + s + "%";
};

const isoToday = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

const fmtDateBR = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addMonthsISO = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
};

const monthKeyOf = (iso) => iso.slice(0, 7); // AAAA-MM

const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[m - 1]}/${String(y).slice(2)}`;
};

/* =========================================================================
   Dados iniciais de exemplo
   ========================================================================= */

const DEFAULT_CATEGORIES = [
  { id: "cat-casa", name: "Casa", icon: "🏠", color: "#5B8CDB" },
  { id: "cat-alimentacao", name: "Alimentação", icon: "🍽️", color: "#E0A63A" },
  { id: "cat-transporte", name: "Transporte", icon: "🚗", color: "#7C8CF8" },
  { id: "cat-lazer", name: "Lazer", icon: "🎮", color: "#C96FE0" },
  { id: "cat-saude", name: "Saúde", icon: "🩺", color: "#E0615B" },
  { id: "cat-educacao", name: "Educação", icon: "📚", color: "#4FAFA0" },
  { id: "cat-compras", name: "Compras", icon: "🛍️", color: "#D98CC2" },
  { id: "cat-recorrente", name: "Recorrente", icon: "🔁", color: "#8C97AD" },
  { id: "cat-financas", name: "Finanças", icon: "💰", color: "#2FAE7C" },
  { id: "cat-investimentos", name: "Investimentos", icon: "📈", color: "#C9A227" },
  { id: "cat-viagem", name: "Viagem", icon: "✈️", color: "#3EA6D9" },
  { id: "cat-salario", name: "Salário", icon: "💼", color: "#2FAE7C" },
  { id: "cat-transferencia", name: "Transferência", icon: "🔀", color: "#8C97AD" },
  { id: "cat-cartao", name: "Fatura de cartão", icon: "💳", color: "#DC5B4B" },
];

const DEFAULT_ACCOUNTS = [
  { id: "acc-nubank", name: "Nubank", institution: "Nu Pagamentos", type: "corrente", color: "#820AD1" },
  { id: "acc-inter", name: "Inter", institution: "Banco Inter", type: "corrente", color: "#FF7A00" },
];

const DEFAULT_CARDS = [
  { id: "card-nubank", name: "Nubank", institution: "Nu Pagamentos", limitCents: 300000, closingDay: 10, dueDay: 17, color: "#820AD1", active: true },
  { id: "card-inter", name: "Inter", institution: "Banco Inter", limitCents: 200000, closingDay: 5, dueDay: 12, color: "#FF7A00", active: true },
];

function seedData() {
  const today = isoToday();
  const t1 = { id: uid(), description: "Exemplo de entrada", valueCents: 127500, type: "income", categoryId: "cat-salario", accountId: "acc-nubank", date: today, status: "paid", note: "", transfer: false };
  const t2 = { id: uid(), description: "Exemplo de mercado", valueCents: 4380, type: "expense", categoryId: "cat-alimentacao", accountId: "acc-nubank", date: today, status: "paid", note: "", transfer: false };
  const t3 = { id: uid(), description: "Exemplo de internet", valueCents: 8990, type: "expense", categoryId: "cat-casa", accountId: "acc-inter", date: today, status: "paid", note: "", transfer: false };
  return {
    categories: DEFAULT_CATEGORIES,
    accounts: DEFAULT_ACCOUNTS,
    cards: DEFAULT_CARDS,
    transactions: [t1, t2, t3],
    fixedAccounts: [
      { id: "fixed-aluguel", name: "Aluguel", valueCents: 134700, dueDay: 28, categoryId: "cat-casa", accountId: "acc-nubank", recurrence: "monthly", startDate: today.slice(0,7)+"-01", active: true },
      { id: "fixed-academia", name: "Academia", valueCents: 7990, dueDay: 15, categoryId: "cat-saude", accountId: "acc-inter", recurrence: "monthly", startDate: today.slice(0,7)+"-01", active: true },
    ],
    bills: [],
    cardPurchases: [
      { id: uid(), description: "Notebook", valueCents: 360000, cardId: "card-nubank", categoryId: "cat-compras", date: today, installments: 12, installmentValueCents: 30000, note: "" },
      { id: uid(), description: "Restaurante", valueCents: 8500, cardId: "card-inter", categoryId: "cat-alimentacao", date: today, installments: 1, installmentValueCents: 8500, note: "" },
    ],
    invoicePayments: {},
    recurringReceipts: [
      { id: uid(), name: "Exemplo de recebimento", valueCents: 125000, day: 12, recurrence: "monthly", startDate: today.slice(0,7)+"-01", active: true },
    ],
    investments: [
      { id: uid(), name: "Tesouro Selic 2029", category: "Renda fixa", institution: "Tesouro Direto", investedCents: 420000, currentCents: 447000, date: addMonthsISO(today, -6), note: "" },
      { id: uid(), name: "Bitcoin", category: "Cripto", institution: "Corretora", investedCents: 165000, currentCents: 171500, date: addMonthsISO(today, -3), note: "" },
      { id: uid(), name: "PETR4", category: "Ações", institution: "Corretora", investedCents: 275000, currentCents: 291000, date: addMonthsISO(today, -8), note: "" },
    ],
    goals: [
      { id: uid(), name: "Exemplo de meta", targetCents: 2450000, currentCents: 875000, deadline: addMonthsISO(today, 10), category: "Compras", description: "" },
      { id: uid(), name: "Exemplo de reserva", targetCents: 1850000, currentCents: 640000, deadline: addMonthsISO(today, 6), category: "Finanças", description: "" },
    ],
    settings: { theme: "dark", activeMonth: today.slice(0, 7), closedMonths: [] },
  };
}

/* =========================================================================
   Storage helpers
   ========================================================================= */

async function loadState() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { if (typeof window !== "undefined") window.location.href = "/login"; return null; }
    const userCacheKey = `${LOCAL_CACHE_KEY}:${user.id}`;
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem(userCacheKey);
      if (cached) {
        try { const parsed = JSON.parse(cached); if (parsed) return ensureFixedOccurrences(parsed); } catch {}
      }
    }
    const { data: row, error } = await supabase.from("finance_user_data").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    let state = row?.data && typeof row.data === "object" ? row.data : row ? {
      categories: DEFAULT_CATEGORIES, accounts: row.accounts || [], cards: row.cards || [], transactions: row.transactions || [],
      bills: row.bills || [], fixedAccounts: row.fixedAccounts || [], recurringReceipts: row.recurringReceipts || [], cardPurchases: row.purchases || [], invoicePayments: row.invoicePayments || {},
      investments: row.investments || [], goals: row.goals || [], settings: { theme: row.theme === "light" ? "light" : "dark", activeMonth: row.activeMonth || isoToday().slice(0,7), closedMonths: row.closedMonths || [] }
    } : seedData();
    state = ensureFixedOccurrences(normalizeState(state));
    if (typeof window !== "undefined") window.localStorage.setItem(userCacheKey, JSON.stringify(state));
    if (!row) await supabase.from("finance_user_data").upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return state;
  } catch (e) {
    console.error("Erro ao carregar dados financeiros:", e);
    if (typeof window !== "undefined") {
      try { const cached = JSON.parse(window.localStorage.getItem(LOCAL_CACHE_KEY) || "null"); if (cached) return ensureFixedOccurrences(cached); } catch {}
    }
    return null;
  }
}

async function saveState(state) {
  if (!state) return false;
  const normalized = normalizeState(state);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const userCacheKey = `${LOCAL_CACHE_KEY}:${user.id}`;
    if (typeof window !== "undefined") window.localStorage.setItem(userCacheKey, JSON.stringify(normalized));
    const payload = { user_id: user.id, data: normalized, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("finance_user_data").upsert(payload, { onConflict: "user_id" });
    if (!error) return true;
    console.error("Erro ao salvar no Supabase:", error);
    return false;
  } catch (e) { console.error("Erro ao salvar dados financeiros:", e); return false; }
}


/* =========================================================================
   Parser seguro de expressões (calculadora comum) — sem eval/Function
   ========================================================================= */

function safeEvaluate(expr) {
  // Tokenizer
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " ") { i++; continue; }
    if ("+-*/()".includes(c)) { tokens.push(c); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      tokens.push(expr.slice(i, j));
      i = j;
      continue;
    }
    throw new Error("Caractere inválido");
  }
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseFactor();
      if (op === "/") {
        if (rhs === 0) throw new Error("Divisão por zero");
        v = v / rhs;
      } else v = v * rhs;
    }
    return v;
  }
  function parseFactor() {
    if (peek() === "-") { next(); return -parseFactor(); }
    if (peek() === "+") { next(); return parseFactor(); }
    if (peek() === "(") {
      next();
      const v = parseExpr();
      if (peek() !== ")") throw new Error("Parênteses não fechados");
      next();
      return v;
    }
    const t = next();
    if (t === undefined || isNaN(parseFloat(t))) throw new Error("Expressão inválida");
    return parseFloat(t);
  }

  if (tokens.length === 0) return 0;
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Expressão inválida");
  if (!Number.isFinite(result)) throw new Error("Resultado inválido");
  return result;
}

/* =========================================================================
   Tema / design tokens (CSS variables)
   ========================================================================= */

const ThemeVars = () => (
  <style>{`
    .mf-root {
      --font-display: 'Fraunces', Georgia, serif;
      --font-body: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
      --radius: 14px;
      --radius-sm: 9px;
      --income: #2FAE7C;
      --expense: #DC5B4B;
      --gold: #C9A227;
      --brand: #0F8F86;
      --brand-2: #17B3A8;
      transition: background-color .25s ease, color .25s ease;
    }
    .mf-root.dark {
      --bg: #0A0E1A;
      --surface: #121A2B;
      --surface-2: #19233A;
      --border: #253150;
      --text: #E9EDF6;
      --text-muted: #90A0C0;
      --text-faint: #5C6A8C;
      --shadow: 0 8px 24px rgba(0,0,0,0.35);
      --overlay: rgba(6,9,18,0.72);
    }
    .mf-root.light {
      --bg: #EEF1F7;
      --surface: #FFFFFF;
      --surface-2: #F6F8FC;
      --border: #DCE2EF;
      --text: #172033;
      --text-muted: #57628A;
      --text-faint: #8994B3;
      --shadow: 0 10px 28px rgba(30,41,80,0.10);
      --overlay: rgba(20,26,46,0.45);
    }
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    .mf-root { background: var(--bg); color: var(--text); font-family: var(--font-body); width: 100%; min-height: 100vh; }
    .mf-root ::selection { background: var(--brand); color: white; }
    .mf-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .mf-display { font-family: var(--font-display); }
    .mf-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .mf-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }
    .mf-focus:focus-visible { outline: 2px solid var(--brand-2); outline-offset: 2px; }
    .mf-sidebar-desktop { position: sticky; top: 0; height: 100vh; box-sizing: border-box; overflow-y: auto; align-self: flex-start; }
    .mf-main-scroll { height: 100vh; box-sizing: border-box; }
    .mf-calc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; width: 100%; box-sizing: border-box; align-items: stretch; }
    .mf-calc-grid button { min-width: 0; width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
    .mf-bill-paid { background: color-mix(in srgb, var(--income) 13%, var(--surface)); border-left: 4px solid var(--income) !important; }
    .mf-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
    .mf-input {
      background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
      border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; width: 100%; font-family: var(--font-body);
    }
    .mf-input:focus { outline: 2px solid var(--brand-2); outline-offset: 0; border-color: transparent; }
    .mf-label { font-size: 12.5px; color: var(--text-muted); margin-bottom: 6px; display:block; font-weight: 600; letter-spacing: .01em; }
    .mf-btn {
      display: inline-flex; align-items: center; justify-content:center; gap: 8px; font-weight: 600; font-size: 14px;
      border-radius: var(--radius-sm); padding: 10px 16px; cursor: pointer; border: 1px solid transparent; transition: all .15s ease;
      font-family: var(--font-body);
    }
    .mf-btn-primary { background: var(--brand); color: white; }
    .mf-btn-primary:hover { background: var(--brand-2); }
    .mf-btn-ghost { background: transparent; color: var(--text); border-color: var(--border); }
    .mf-btn-ghost:hover { background: var(--surface-2); }
    .mf-btn-danger { background: var(--expense); color: white; }
    .mf-btn-danger:hover { filter: brightness(1.08); }
    .mf-btn:disabled { opacity: .5; cursor: not-allowed; }
    .mf-mobile-bottom { display: none; }
    .mf-mobile-quick-grid { max-width: 520px; margin: 0 auto; }
    @media (max-width: 899px) {
      .mf-mobile-bottom { display: flex; }
      .mf-main-scroll { padding-bottom: 82px; }
    }
    @keyframes mf-fade-in { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: translateY(0);} }
    @keyframes mf-pop { from { opacity: 0; transform: scale(.96);} to { opacity: 1; transform: scale(1);} }
    .mf-anim-in { animation: mf-fade-in .2s ease; }
    .mf-anim-pop { animation: mf-pop .15s ease; }
    @media (max-width: 899px) {
      .mf-main-scroll { padding-bottom: 92px; }
      .mf-sidebar-desktop { display: none !important; }
      .mf-menu-btn { display: flex !important; }
    }
    @media (min-width: 900px) {
      .mf-menu-btn { display: none !important; }
    }
    .mf-modal-overlay { align-items: flex-end; }
    .mf-modal-card { border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin: 0 auto; }
    @media (min-width: 640px) {
      .mf-modal-overlay { align-items: center; padding: 20px !important; }
      .mf-modal-card { border-radius: var(--radius) !important; margin: auto; }
    }
  `}</style>
);

/* =========================================================================
   Contexto de Toasts
   ========================================================================= */

const PrivacyCtx = createContext(null);
function PrivacyProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  return <PrivacyCtx.Provider value={{ hidden, setHidden }}>{children}</PrivacyCtx.Provider>;
}
const usePrivacy = () => useContext(PrivacyCtx);

const ToastCtx = createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = "default") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 200, display: "flex", flexDirection: "column", gap: 8, maxWidth: "calc(100vw - 32px)" }}>
        {toasts.map((t) => (
          <div key={t.id} className="mf-card mf-anim-in" style={{
            padding: "12px 16px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, minWidth: 220,
            borderLeft: `3px solid ${t.kind === "error" ? "var(--expense)" : "var(--brand-2)"}`
          }}>
            <Check size={16} color={t.kind === "error" ? "var(--expense)" : "var(--income)"} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx);

/* =========================================================================
   Componentes básicos reutilizáveis
   ========================================================================= */

function Money({ cents, sign = false, size = "inherit", positiveColor, negativeColor, weight = 600 }) {
  const privacy = usePrivacy();
  const n = cents || 0;
  let color = "inherit";
  if (sign) color = n > 0 ? (positiveColor || "var(--income)") : n < 0 ? (negativeColor || "var(--expense)") : "inherit";
  return <span className="mf-mono" style={{ fontSize: size, color, fontWeight: weight }}>{privacy?.hidden ? "••••••" : brl(n, { sign })}</span>;
}

function Modal({ open, onClose, title, children, width = 520, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="mf-anim-in mf-modal-overlay"
      style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 100, display: "flex", justifyContent: "center", padding: 0 }}
    >
      <div
        className="mf-card mf-scroll mf-anim-pop mf-modal-card"
        style={{ width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto", padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 className="mf-display" style={{ fontSize: 19, margin: 0 }}>{title}</h3>
          <button aria-label="Fechar" className="mf-focus" onClick={onClose} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>{footer}</div>}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onCancel, onConfirm, danger = true }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width={400} footer={
      <>
        <button className="mf-btn mf-btn-ghost mf-focus" onClick={onCancel}>Cancelar</button>
        <button className={`mf-btn ${danger ? "mf-btn-danger" : "mf-btn-primary"} mf-focus`} onClick={onConfirm}>Excluir</button>
      </>
    }>
      <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>{message}</p>
    </Modal>
  );
}

function EmptyState({ icon: Icon = AlertCircle, title, description, action }) {
  return (
    <div className="mf-card mf-anim-in" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)" }}>
        <Icon size={22} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{title}</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13.5, maxWidth: 360 }}>{description}</div>
      {action}
    </div>
  );
}

function StatCard({ label, valueCents, icon: Icon, tone = "neutral", sub }) {
  const toneColor = tone === "income" ? "var(--income)" : tone === "expense" ? "var(--expense)" : tone === "gold" ? "var(--gold)" : "var(--brand-2)";
  return (
    <div className="mf-card mf-anim-in" style={{ padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="mf-label" style={{ margin: 0, textTransform: "uppercase" }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${toneColor}22`, display: "flex", alignItems: "center", justifyContent: "center", color: toneColor, flexShrink: 0 }}>
          <Icon size={15} />
        </div>
      </div>
      <div className="mf-mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: tone === "neutral" ? "var(--text)" : toneColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <Money cents={valueCents} weight={700} />
      </div>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${toneColor}, transparent)`, borderRadius: 3, marginTop: 12, opacity: .55 }} />
      {sub && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

function IconBadge({ icon, color }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
      {icon}
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ padding: "9px 12px", fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", color: "var(--text)", boxShadow: "0 10px 28px rgba(0,0,0,.18)" }}>
      {label && <div style={{ color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || p.fill }} />
          {formatter ? formatter(p) : `${p.name}: ${brl(p.value)}`}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label className="mf-label">{label}</label>{children}</div>;
}

function SegTabs({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, background: "var(--surface-2)", padding: 4, borderRadius: 11, border: "1px solid var(--border)", flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.value} className="mf-focus" onClick={() => onChange(o.value)}
          style={{
            padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: value === o.value ? "var(--brand)" : "transparent",
            color: value === o.value ? "white" : "var(--text-muted)", transition: "all .15s"
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* =========================================================================
   App raiz
   ========================================================================= */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "transactions", label: "Transações", icon: ArrowLeftRight },
  { key: "accounts", label: "Contas", icon: Landmark },
  { key: "planning", label: "Planejamento", icon: CalendarDays },
  { key: "cards", label: "Cartões", icon: CreditCard },
  { key: "investments", label: "Investimentos", icon: TrendingUp },
  { key: "goals", label: "Metas", icon: Target },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "calculator", label: "Calculadora", icon: CalcIcon },
  { key: "categories", label: "Categorias", icon: Tags },
  { key: "settings", label: "Configurações", icon: SettingsIcon },
];

export default function MeuFinanceiro() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [quickAction, setQuickAction] = useState(null);
  const saveTimer = useRef(null);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const metadataName = safeString(user.user_metadata?.name || user.user_metadata?.full_name || user.user_metadata?.nome).trim();
      setUserName(metadataName || safeString(user.email).split("@")[0] || "Usuário");

      const d = await loadState();
      if (!active) return;

      if (!d) {
        window.location.href = "/login";
        return;
      }

      setData(ensureFixedOccurrences(d, isoToday().slice(0, 7)));
      setLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveState(data); }, 350);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  // Se o navegador ficou aberto quando virou o mês, cria apenas a nova
  // ocorrência idempotente. Não cria transações nem pagamentos.
  useEffect(() => {
    if (!loaded || !data) return;
    const currentMonth = isoToday().slice(0, 7);
    setData((d) => {
      const activeMonth = d.settings?.activeMonth;
      const nextActiveMonth = activeMonth && /^\d{4}-\d{2}$/.test(activeMonth) ? activeMonth : currentMonth;
      return ensureFixedOccurrences({
        ...d,
        settings: { ...(d.settings || {}), activeMonth: nextActiveMonth },
      }, nextActiveMonth);
    });
  }, [loaded]);

  const theme = data?.settings?.theme || "dark";

  if (!loaded || !data) {
    return (
      <div className="mf-root dark" style={{ minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16 }}>
        <ThemeVars />
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregando Meu Financeiro…</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <PrivacyProvider>
      <div className={`mf-root ${theme}`} style={{ minHeight: "100vh", borderRadius: 0, overflow: "hidden", display: "flex", position: "relative", fontSize: 14 }}>
        <ThemeVars />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" />

        {/* Sidebar desktop */}
        <aside className="mf-scroll mf-sidebar-desktop" style={{
          width: 232, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "20px 14px",
          display: "flex", flexDirection: "column", gap: 4, background: "var(--surface)"
        }}>
          <Brand />
          <nav style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((n) => <NavItem key={n.key} item={n} active={tab === n.key} onClick={() => setTab(n.key)} />)}
          </nav>
          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="mf-btn mf-btn-ghost mf-focus" onClick={handleLogout} style={{ width: "100%" }}>Sair</button>
            <ThemeToggle theme={theme} onToggle={() => setData((d) => ({ ...d, settings: { ...d.settings, theme: theme === "dark" ? "light" : "dark" } }))} />
          </div>
        </aside>

        {/* Drawer mobile */}
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
            <div style={{ position: "absolute", inset: 0, background: "var(--overlay)" }} />
            <aside className={`mf-root ${theme} mf-scroll`} style={{ position: "relative", width: 250, background: "var(--surface)", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4, height: "100%", overflowY: "auto", animation: "mf-fade-in .18s ease" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Brand />
                <button aria-label="Fechar menu" className="mf-focus" onClick={() => setDrawerOpen(false)} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, width: 34, height: 34, minWidth: 34, padding: 0, color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}><X size={18} strokeWidth={2.2} /></button>
              </div>
              <nav style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 2 }}>
                {NAV.map((n) => <NavItem key={n.key} item={n} active={tab === n.key} onClick={() => { setTab(n.key); setDrawerOpen(false); }} />)}
              </nav>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="mf-btn mf-btn-ghost mf-focus" onClick={handleLogout} style={{ width: "100%" }}>Sair</button>
                <ThemeToggle theme={theme} onToggle={() => setData((d) => ({ ...d, settings: { ...d.settings, theme: theme === "dark" ? "light" : "dark" } }))} />
              </div>
            </aside>
          </div>
        )}

        {/* Conteúdo */}
        <main className="mf-scroll mf-main-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", minHeight: "100vh" }}>
          <header style={{
            position: "sticky", top: 0, zIndex: 10, background: "var(--bg)", borderBottom: "1px solid var(--border)",
            padding: "14px 20px", display: "flex", alignItems: "center", gap: 12
          }}>
            <button className="mf-focus mf-menu-btn" onClick={() => setDrawerOpen(true)} style={{
              display: "none", background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 9, width: 36, height: 36, alignItems: "center", justifyContent: "center", color: "var(--text)", flexShrink: 0
            }}>
              <Menu size={18} />
            </button>
            <h2 className="mf-display" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{NAV.find((n) => n.key === tab)?.label}</h2>
          </header>
          <div style={{ padding: "20px", maxWidth: 1180, margin: "0 auto" }}>
            {tab === "dashboard" && <Dashboard data={data} setData={setData} goTab={setTab} userName={userName} />}
            {tab === "transactions" && <Transactions data={data} setData={setData} quickAction={quickAction} clearQuickAction={() => setQuickAction(null)} />}
            {tab === "accounts" && <Accounts data={data} setData={setData} />}
            {tab === "planning" && <Planning data={data} setData={setData} />}
            {tab === "cards" && <Cards data={data} setData={setData} quickAction={quickAction} clearQuickAction={() => setQuickAction(null)} />}
            {tab === "investments" && <Investments data={data} setData={setData} />}
            {tab === "goals" && <Goals data={data} setData={setData} />}
            {tab === "reports" && <Reports data={data} />}
            {tab === "calculator" && <CalculatorSection />}
            {tab === "categories" && <Categories data={data} setData={setData} />}
            {tab === "settings" && <SettingsSection data={data} setData={setData} />}
          </div>
        </main>

        <MobileQuickActions
          tab={tab}
          setTab={setTab}
          quickAction={quickAction}
          setQuickAction={setQuickAction}
        />
      </div>
      </PrivacyProvider>
    </ToastProvider>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, var(--brand), var(--brand-2))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Wallet size={16} color="white" />
      </div>
      <div>
        <div className="mf-display" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>Meu Financeiro</div>
        <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>controle pessoal</div>
      </div>
    </div>
  );
}

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button className="mf-focus" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer",
      background: active ? "var(--surface-2)" : "transparent", color: active ? "var(--brand-2)" : "var(--text-muted)",
      fontWeight: active ? 700 : 500, fontSize: 13.5, textAlign: "left", width: "100%",
      borderLeft: active ? "3px solid var(--brand-2)" : "3px solid transparent"
    }}>
      <Icon size={17} /> {item.label}
    </button>
  );
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="mf-btn mf-btn-ghost mf-focus" onClick={onToggle} style={{ width: "100%" }}>
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      {theme === "dark" ? "Tema claro" : "Tema escuro"}
    </button>
  );
}

/* =========================================================================
   Cálculos financeiros derivados
   ========================================================================= */

function useFinance(data) {
  return useMemo(() => {
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const bills = Array.isArray(data.bills) ? data.bills : [];
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const accountBalance = (accId) => {
      let bal = 0;
      for (const t of transactions) {
        if (t.accountId !== accId || t.status !== "paid") continue;
        bal += t.type === "income" ? safeCents(t.valueCents) : -safeCents(t.valueCents);
      }
      for (const b of bills) {
        if (b.status !== "paid" || (b.paymentAccountId || b.accountId) !== accId) continue;
        bal -= safeCents(b.valueCents);
      }
      return bal;
    };
    const totalBalance = accounts.reduce((s, a) => s + accountBalance(a.id), 0);
    const inRange = (iso, start, end) => (!start || iso >= start) && (!end || iso <= end);
    const periodTotals = (start, end) => {
      let income = 0, expense = 0;
      for (const t of transactions) {
        if (t.status !== "paid" || t.transfer || !inRange(t.date, start, end)) continue;
        if (t.type === "income") income += safeCents(t.valueCents); else expense += safeCents(t.valueCents);
      }
      for (const b of bills) {
        if (b.status === "paid" && inRange(b.paidDate || b.dueDate, start, end)) expense += safeCents(b.valueCents);
      }
      return { income, expense, savings: income - expense };
    };
    const categoryName = (id) => categories.find((c) => c.id === id)?.name || "Sem categoria";
    const categoryOf = (id) => categories.find((c) => c.id === id);
    return { accountBalance, totalBalance, periodTotals, categoryName, categoryOf };
  }, [data]);
}

function PrivacyToggle() {
  const { hidden, setHidden } = usePrivacy();
  return (
    <button aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} className="mf-focus" onClick={() => setHidden(v => !v)} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      {hidden ? <EyeOff size={18}/> : <Eye size={18}/>}
    </button>
  );
}

function MobileQuickActions({ tab, setTab, quickAction, setQuickAction }) {
  const [open, setOpen] = useState(false);
  const action = (type) => {
    setOpen(false);
    setQuickAction(type);
    if (type === "income" || type === "expense" || type === "transfer") setTab("transactions");
    if (type === "cardExpense") setTab("cards");
    if (type === "account") setTab("accounts");
    if (type === "planning") setTab("planning");
  };
  const items = [
    { key: "income", label: "Receita", icon: ArrowUpCircle, tone: "var(--income)" },
    { key: "cardExpense", label: "Despesa Cartão", icon: CreditCard, tone: "var(--brand-2)" },
    { key: "transfer", label: "Transferência", icon: ArrowRightLeft, tone: "var(--brand-2)" },
    { key: "expense", label: "Despesa", icon: ArrowDownCircle, tone: "var(--expense)" },
    { key: "account", label: "Conta", icon: Landmark, tone: "var(--brand-2)" },
    { key: "planning", label: "Planejamento", icon: CalendarDays, tone: "var(--brand-2)" },
  ];
  return (
    <div className="mf-mobile-bottom" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "8px 14px max(8px, env(safe-area-inset-bottom))", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", alignItems: "center", justifyItems: "center" }}>
      {open && <div className="mf-mobile-quick-grid" style={{ position: "absolute", left: 0, right: 0, bottom: 72, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, padding: "0 14px", maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
        {items.map(({ key, label, icon: Icon, tone }) => (
          <button key={key} className="mf-card mf-focus mf-anim-pop" onClick={() => action(key)} style={{ minHeight: 76, padding: 10, color: "var(--text)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <span style={{ width: 38, height: 38, borderRadius: "50%", background: `${tone}22`, color: tone, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19}/></span>
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>{label}</span>
          </button>
        ))}
      </div>}
      <button className="mf-focus" onClick={() => setTab("dashboard")} style={{ width: "100%", background: "none", border: 0, color: tab === "dashboard" ? "var(--brand-2)" : "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.5, fontWeight: 700 }}><LayoutDashboard size={19}/><span>Início</span></button>
      <button className="mf-focus" onClick={() => setTab("transactions")} style={{ width: "100%", background: "none", border: 0, color: tab === "transactions" ? "var(--brand-2)" : "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.5, fontWeight: 700 }}><ArrowLeftRight size={19}/><span>Transações</span></button>
      <button aria-label="Adicionar lançamento" className="mf-focus" onClick={() => setOpen(v => !v)} style={{ width: 54, height: 54, marginTop: -26, justifySelf: "center", borderRadius: "50%", border: "4px solid var(--bg)", background: "var(--brand)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 22px rgba(0,0,0,.25)" }}>{open ? <X size={27}/> : <Plus size={28}/>}</button>
      <button className="mf-focus" onClick={() => setTab("goals")} style={{ width: "100%", background: "none", border: 0, color: tab === "goals" ? "var(--brand-2)" : "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.5, fontWeight: 700 }}><Target size={19}/><span>Metas</span></button>
      <button className="mf-focus" onClick={() => setTab("settings")} style={{ width: "100%", background: "none", border: 0, color: tab === "settings" ? "var(--brand-2)" : "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.5, fontWeight: 700 }}><SettingsIcon size={19}/><span>Mais</span></button>
    </div>
  );
}

/* =========================================================================
   DASHBOARD / FECHAMENTO DE MÊS
   ========================================================================= */

function getActiveMonth(data) {
  const actual = isoToday().slice(0, 7);
  const stored = data?.settings?.activeMonth;
  if (!stored || !/^\d{4}-\d{2}$/.test(stored)) return actual;
  return stored;
}

function fullMonthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${names[m - 1]} ${y}`;
}

function MonthSelector({ data, setData }) {
  const activeMonth = getActiveMonth(data);
  const months = [-2, -1, 0, 1, 2].map(offset => monthKeyOf(addMonthsISO(activeMonth + "-01", offset)));
  const changeMonth = (monthKey) => {
    setData(d => ensureFixedOccurrences({
      ...d,
      settings: { ...(d.settings || {}), activeMonth: monthKey },
    }, monthKey));
  };
  const move = (offset) => changeMonth(monthKeyOf(addMonthsISO(activeMonth + "-01", offset)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <button aria-label="Mês anterior" className="mf-focus" onClick={() => move(-1)} style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={18}/></button>
      <div className="mf-month-strip" style={{ display: "flex", gap: 8, overflowX: "auto", flex: 1, scrollbarWidth: "none", padding: "2px 0" }}>
        {months.map(mk => (
          <button key={mk} className="mf-focus" onClick={() => changeMonth(mk)} style={{ flex: "0 0 auto", minWidth: 118, padding: "10px 16px", borderRadius: 999, border: "1px solid", borderColor: mk === activeMonth ? "var(--brand)" : "var(--border)", background: mk === activeMonth ? "var(--brand)" : "var(--surface)", color: mk === activeMonth ? "white" : "var(--text-muted)", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{fullMonthLabel(mk)}</button>
        ))}
      </div>
      <button aria-label="Próximo mês" className="mf-focus" onClick={() => move(1)} style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronRight size={18}/></button>
    </div>
  );
}

function monthEndISO(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function Dashboard({ data, setData, goTab, userName }) {
  const fin = useFinance(data);
  const today = isoToday();
  const activeMonth = getActiveMonth(data);
  const monthStart = activeMonth + "-01";
  const monthEnd = monthEndISO(activeMonth);
  const periodEnd = activeMonth === today.slice(0, 7) ? today : monthEnd;
  const { income, expense, savings } = fin.periodTotals(monthStart, periodEnd);
  const monthBalance = savings;

  const recent = [...data.transactions]
    .filter(t => monthKeyOf(t.date) === activeMonth)
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 6);

  const upcoming = data.bills
    .filter((b) => b.status === "pending" && monthKeyOf(b.dueDate) === activeMonth)
    .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1))
    .slice(0, 5);

  const fixedThisMonth = data.bills
    .filter((b) => b.fixed && monthKeyOf(b.dueDate) === activeMonth)
    .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

  const toggleBillPayment = (billId) => {
    setData((d) => {
      const bill = d.bills.find((b) => b.id === billId);
      if (!bill) return d;

      if (bill.status === "paid") {
        return {
          ...d,
          bills: d.bills.map((b) => b.id === billId
            ? { ...b, status: "pending", paidDate: null, paymentId: null }
            : b),
        };
      }

      return {
        ...d,
        bills: d.bills.map((b) => b.id === billId
          ? {
              ...b,
              status: "paid",
              paidDate: isoToday(),
              paymentId: b.paymentId || uid(),
              paymentAccountId: b.paymentAccountId || b.accountId || "",
            }
          : b),
      };
    });
  };

  const catSpend = useMemo(() => {
    const map = {};
    for (const t of data.transactions) {
      if (t.type !== "expense" || t.status !== "paid" || t.transfer) continue;
      if (monthKeyOf(t.date) !== activeMonth) continue;
      map[t.categoryId] = (map[t.categoryId] || 0) + safeCents(t.valueCents);
    }
    for (const b of data.bills || []) {
      if (b.status !== "paid" || monthKeyOf(b.paidDate || b.dueDate) !== activeMonth) continue;
      map[b.categoryId] = (map[b.categoryId] || 0) + safeCents(b.valueCents);
    }
    return Object.entries(map)
      .map(([id, v]) => ({ id, name: fin.categoryName(id), value: v / 100, color: fin.categoryOf(id)?.color || "#888" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data, fin, activeMonth]);

  const evolution = useMemo(() => buildEvolution(data), [data]);

  return (
    <div className="mf-anim-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div className="mf-display" style={{ fontSize: 21, fontWeight: 700 }}>Olá, {userName || "Usuário"} 👋</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>Resumo financeiro de {fullMonthLabel(activeMonth)}.</div>
        </div>
        <PrivacyToggle />
      </div>
      <MonthSelector data={data} setData={setData} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Saldo" valueCents={monthBalance} icon={Wallet} tone="neutral" />
        <StatCard label="Entradas (mês)" valueCents={income} icon={ArrowUpCircle} tone="income" />
        <StatCard label="Saídas (mês)" valueCents={expense} icon={ArrowDownCircle} tone="expense" />
        <StatCard label="Economia (mês)" valueCents={savings} icon={TrendingUp} tone={savings >= 0 ? "income" : "expense"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 14 }} className="mf-grid-2">
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Evolução da economia" subtitle="Últimos 6 meses" />
          <div style={{ width: "100%", height: 230 }}>
            <ResponsiveContainer>
              <LineChart data={evolution} margin={{ left: -18, right: 10, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--text-faint)" fontSize={12} />
                <YAxis stroke="var(--text-faint)" fontSize={11} tickFormatter={(v) => (v / 100).toLocaleString("pt-BR")} />
                <RTooltip content={<ChartTooltip formatter={(p) => `${p.name}: ${brl(p.value)}`} />} />
                <Line type="monotone" dataKey="savings" name="Economia" stroke="var(--brand-2)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Gastos por categoria" subtitle={`Mês ativo · ${monthLabel(activeMonth)}`} />
          {catSpend.length === 0 ? (
            <EmptyState icon={Tags} title="Sem gastos ainda" description="Registre transações para ver a distribuição." />
          ) : (
            <div style={{ width: "100%", height: 230 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catSpend} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>
                    {catSpend.map((c, i) => <Cell key={i} fill={c.color} stroke="var(--surface)" strokeWidth={2} />)}
                  </Pie>
                  <RTooltip content={<ChartTooltip formatter={(p) => `${p.name}: ${brl(p.value * 100)}`} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }} className="mf-grid-2">
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Contas fixas do mês" subtitle={`${fixedThisMonth.length} ocorrência(s) · ${monthLabel(activeMonth)}`} action={<LinkBtn onClick={() => goTab("accounts")}>Ver contas</LinkBtn>} />
          {fixedThisMonth.length === 0 ? (
            <EmptyState icon={Landmark} title="Nenhuma conta fixa" description="Cadastre aluguel, internet, luz e outras recorrências." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {fixedThisMonth.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>vence {fmtDateBR(b.dueDate)} · {b.status === "paid" ? "Paga" : "Pendente"}</div>
                  </div>
                  <Money cents={b.valueCents} weight={700} />
                  <button
                    className={`mf-btn ${b.status === "paid" ? "mf-btn-ghost" : "mf-btn-primary"} mf-focus`}
                    style={{ padding: "6px 9px", fontSize: 11.5 }}
                    onClick={() => toggleBillPayment(b.id)}
                  >
                    {b.status === "paid" ? "Marcar como pendente" : "Marcar como paga"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Próximas contas" action={<LinkBtn onClick={() => goTab("accounts")}>Gerenciar</LinkBtn>} />
          {upcoming.length === 0 ? <EmptyState icon={Landmark} title="Tudo em dia" description="Nenhuma conta pendente neste mês." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcoming.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>vence {fmtDateBR(b.dueDate)}</div>
                  </div>
                  <Money cents={b.valueCents} weight={700} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mf-card" style={{ padding: 18 }}>
        <SectionTitle title="Últimos lançamentos" action={<LinkBtn onClick={() => goTab("transactions")}>Ver todas</LinkBtn>} />
        {recent.length === 0 ? <EmptyState icon={ArrowLeftRight} title="Nenhum lançamento" description="Adicione sua primeira transação." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recent.map((t) => <TxRow key={t.id} t={t} cat={fin.categoryOf(t.categoryId)} />)}
          </div>
        )}
      </div>
      <style>{`@media (max-width: 760px) { .mf-grid-2 { grid-template-columns: 1fr !important; } .mf-card { max-width: 100%; } }`}</style>
    </div>
  );
}

function inCurrentMonth(iso) {
  return iso.slice(0, 7) === isoToday().slice(0, 7);
}

function buildEvolution(data) {
  const transactions = data.transactions || [];
  const bills = data.bills || [];
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(monthKeyOf(addMonthsISO(isoToday(), -i)));
  return months.map((mk) => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      if (t.status !== "paid" || t.transfer) continue;
      if (monthKeyOf(t.date) !== mk) continue;
      if (t.type === "income") income += safeCents(t.valueCents); else expense += safeCents(t.valueCents);
    }
    for (const b of bills) {
      if (b.status === "paid" && monthKeyOf(b.paidDate || b.dueDate) === mk) expense += safeCents(b.valueCents);
    }
    return { key: mk, label: monthLabel(mk), income, expense, savings: income - expense };
  });
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
      <div>
        <div className="mf-display" style={{ fontWeight: 600, fontSize: 15.5 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function LinkBtn({ children, onClick }) {
  return <button className="mf-focus" onClick={onClick} style={{ background: "none", border: "none", color: "var(--brand-2)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>{children}<ChevronRight size={13} /></button>;
}

function TxRow({ t, cat }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <IconBadge icon={cat?.icon || "💸"} color={cat?.color || "#888"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{fmtDateBR(t.date)} · {cat?.name || "—"} {t.status === "pending" && "· pendente"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {t.type === "income" ? <ArrowUpCircle size={14} color="var(--income)" /> : <ArrowDownCircle size={14} color="var(--expense)" />}
        <Money cents={t.type === "income" ? t.valueCents : -t.valueCents} sign weight={700} />
      </div>
    </div>
  );
}

/* =========================================================================
   TRANSAÇÕES
   ========================================================================= */

function emptyTx() { return { id: null, description: "", value: "", type: "expense", categoryId: "", accountId: "", date: isoToday(), note: "" }; }

function Transactions({ data, setData, quickAction, clearQuickAction }) {
  const toast = useToast(); const fin = useFinance(data);
  const activeMonth = getActiveMonth(data);
  const [modal, setModal] = useState(false), [form, setForm] = useState(emptyTx()), [errors, setErrors] = useState({}), [confirmId, setConfirmId] = useState(null), [search, setSearch] = useState(""), [filterType, setFilterType] = useState("all"), [sortDesc, setSortDesc] = useState(true), [transferModal, setTransferModal] = useState(false);
  const openNew = (type = "expense") => { setForm({ ...emptyTx(), type, date: activeMonth + "-01" }); setErrors({}); setModal(true); };
  useEffect(() => {
    if (!quickAction) return;
    if (quickAction === "income" || quickAction === "expense") openNew(quickAction);
    if (quickAction === "transfer") {
      // Transferência é aberta pelo botão próprio da tela de transações.
      setTransferModal(true);
    }
    clearQuickAction?.();
  }, [quickAction]);
  const openEdit = (t) => { setForm({ ...t, value: (safeCents(t.valueCents) / 100).toFixed(2).replace(".", ",") }); setErrors({}); setModal(true); };
  const validate = () => { const e = {}; if (!safeString(form.description).trim()) e.description = "Descrição obrigatória"; if (toCents(form.value) <= 0) e.value = "Valor precisa ser maior que zero"; if (!form.categoryId) e.categoryId = "Selecione uma categoria"; if (!form.accountId) e.accountId = "Selecione uma conta"; if (!form.date) e.date = "Data obrigatória"; setErrors(e); return !Object.keys(e).length; };
  const save = () => { if (!validate()) return; const valueCents = toCents(form.value); setData((d) => ({ ...d, transactions: form.id ? d.transactions.map((t) => t.id === form.id ? { ...t, description: form.description.trim(), valueCents, type: form.type, categoryId: form.categoryId, accountId: form.accountId, date: form.date, note: form.note || "", status: "paid", transfer: !!t.transfer } : t) : [...d.transactions, { id: uid(), description: form.description.trim(), valueCents, type: form.type, categoryId: form.categoryId, accountId: form.accountId, date: form.date, status: "paid", note: form.note || "", transfer: false }] })); toast(form.id ? "Transação atualizada." : "Transação adicionada."); setModal(false); };
  const remove = (id) => { setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) })); toast("Transação removida."); setConfirmId(null); };
  const list = useMemo(() => { let arr = data.transactions.filter((t) => !t.sourceBillId && !t.sourceBillOccurrenceId && monthKeyOf(t.date) === activeMonth); if (filterType !== "all") arr = arr.filter((t) => t.type === filterType); const s = search.trim().toLowerCase(); if (s) arr = arr.filter((t) => safeString(t.description).toLowerCase().includes(s)); return [...arr].sort((a,b) => sortDesc ? (a.date < b.date ? 1 : -1) : (a.date > b.date ? 1 : -1)); }, [data.transactions, filterType, search, sortDesc, activeMonth]);
  return <div className="mf-anim-in">
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}><div style={{position:"relative",flex:"1 1 200px",minWidth:160}}><Search size={15} style={{position:"absolute",left:11,top:11,color:"var(--text-faint)"}}/><input className="mf-input" style={{paddingLeft:34}} placeholder="Pesquisar transações…" value={search} onChange={(e)=>setSearch(e.target.value)}/></div><SegTabs value={filterType} onChange={setFilterType} options={[{value:"all",label:"Todas"},{value:"income",label:"Entradas"},{value:"expense",label:"Saídas"}]}/><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setSortDesc(s=>!s)}><Filter size={14}/> {sortDesc?"Mais recentes":"Mais antigas"}</button><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setTransferModal(true)}><ArrowRightLeft size={14}/> Transferir</button><button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15}/> Nova transação</button></div>
    {list.length===0?<EmptyState icon={ArrowLeftRight} title="Nenhuma transação encontrada" description="Adicione uma transação ou ajuste os filtros de pesquisa." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={14}/> Nova transação</button>}/>:<div className="mf-card" style={{overflow:"hidden"}}>{list.map((t,idx)=>{const cat=fin.categoryOf(t.categoryId),acc=data.accounts.find(a=>a.id===t.accountId);return <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderTop:idx===0?"none":"1px solid var(--border)"}}><IconBadge icon={cat?.icon||"💸"} color={cat?.color||"#888"}/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13.5}}>{t.description}</div><div style={{fontSize:11.5,color:"var(--text-faint)"}}>{fmtDateBR(t.date)} · {cat?.name||"—"} · {acc?.name||"—"}</div></div><Money cents={t.type==="income"?t.valueCents:-t.valueCents} sign weight={700} size={14}/><div style={{display:"flex",gap:4}}><IconBtn onClick={()=>openEdit(t)}><Pencil size={14}/></IconBtn><IconBtn onClick={()=>setConfirmId(t.id)} danger><Trash2 size={14}/></IconBtn></div></div>})}</div>}
    <Modal open={modal} onClose={()=>setModal(false)} title={form.id?"Editar transação":"Nova transação"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button></>}><SegTabs value={form.type} onChange={v=>setForm(f=>({...f,type:v}))} options={[{value:"expense",label:"Saída"},{value:"income",label:"Entrada"}]}/><div style={{height:14}}/><Field label="Descrição"><input className="mf-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Ex: Mercado, Salário…"/>{errors.description&&<ErrorText>{errors.description}</ErrorText>}</Field><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Field label="Valor (R$)"><input className="mf-input" inputMode="decimal" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} placeholder="0,00"/>{errors.value&&<ErrorText>{errors.value}</ErrorText>}</Field><Field label="Data"><input className="mf-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>{errors.date&&<ErrorText>{errors.date}</ErrorText>}</Field></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Field label="Categoria"><select className="mf-input" value={form.categoryId} onChange={e=>setForm(f=>({...f,categoryId:e.target.value}))}><option value="">Selecione…</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>{errors.categoryId&&<ErrorText>{errors.categoryId}</ErrorText>}</Field><Field label="Conta"><select className="mf-input" value={form.accountId} onChange={e=>setForm(f=>({...f,accountId:e.target.value}))}><option value="">Selecione…</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{errors.accountId&&<ErrorText>{errors.accountId}</ErrorText>}</Field></div><Field label="Observação (opcional)"><input className="mf-input" value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></Field></Modal>
    <TransferModal open={transferModal} onClose={()=>setTransferModal(false)} data={data} setData={setData} toast={toast}/><ConfirmDialog open={!!confirmId} title="Excluir transação" message={`Excluir "${data.transactions.find(t=>t.id===confirmId)?.description||""}"? Essa ação não pode ser desfeita.`} onCancel={()=>setConfirmId(null)} onConfirm={()=>remove(confirmId)}/>
  </div>;
}

function TransferModal({ open, onClose, data, setData, toast }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(isoToday());
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setFrom(data.accounts[0]?.id || ""); setTo(data.accounts[1]?.id || ""); setValue(""); setError(""); setDate(isoToday()); } }, [open]);

  const submit = () => {
    const cents = toCents(value);
    if (!from || !to) return setError("Selecione as duas contas.");
    if (from === to) return setError("Selecione contas diferentes.");
    if (cents <= 0) return setError("Informe um valor válido.");
    const pairA = uid(), pairB = uid();
    const catId = "cat-transferencia";
    setData((d) => ({
      ...d,
      transactions: [...d.transactions,
        { id: pairA, description: `Transferência para ${d.accounts.find(a => a.id === to)?.name}`, valueCents: cents, type: "expense", categoryId: catId, accountId: from, date, status: "paid", note: "", transfer: true, transferPairId: pairB },
        { id: pairB, description: `Transferência de ${d.accounts.find(a => a.id === from)?.name}`, valueCents: cents, type: "income", categoryId: catId, accountId: to, date, status: "paid", note: "", transfer: true, transferPairId: pairA },
      ]
    }));
    toast("Transferência realizada.");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Transferir entre contas" footer={<>
      <button className="mf-btn mf-btn-ghost mf-focus" onClick={onClose}>Cancelar</button>
      <button className="mf-btn mf-btn-primary mf-focus" onClick={submit}>Transferir</button>
    </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="De">
          <select className="mf-input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Para">
          <select className="mf-input" value={to} onChange={(e) => setTo(e.target.value)}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Valor (R$)"><input className="mf-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" /></Field>
        <Field label="Data"><input className="mf-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Transferências não afetam o total de entradas/saídas dos relatórios — apenas movem dinheiro entre contas.</p>
    </Modal>
  );
}

function Badge({ children, color }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}22`, padding: "2px 7px", borderRadius: 6 }}>{children}</span>;
}
function ErrorText({ children }) {
  return <div style={{ color: "var(--expense)", fontSize: 12, marginTop: 5 }}>{children}</div>;
}
function IconBtn({ children, onClick, danger }) {
  return (
    <button className="mf-focus" onClick={onClick} style={{
      width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)",
      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: danger ? "var(--expense)" : "var(--text-muted)"
    }}>{children}</button>
  );
}

/* =========================================================================
   CONTAS
   ========================================================================= */

const ACCOUNT_COLORS = ["#820AD1", "#FF7A00", "#0F8F86", "#2FAE7C", "#DC5B4B", "#C9A227", "#3EA6D9", "#8C97AD"];

function emptyAccount() { return { id: null, name: "", institution: "", type: "corrente", color: ACCOUNT_COLORS[0] }; }

function Accounts({ data, setData }) {
  const [subTab, setSubTab] = useState("contas");
  return <div className="mf-anim-in"><div style={{marginBottom:18}}><SegTabs value={subTab} onChange={setSubTab} options={[{value:"contas",label:"Contas bancárias"},{value:"bills",label:"Contas a pagar"},{value:"fixed",label:"Contas Fixas"}]}/></div>{subTab==="contas"?<AccountsList data={data} setData={setData}/>:subTab==="bills"?<Bills data={data} setData={setData}/>:<FixedAccounts data={data} setData={setData}/>}</div>;
}

function AccountsList({ data, setData }) {
  const fin=useFinance(data), toast=useToast(); const [modal,setModal]=useState(false),[form,setForm]=useState(emptyAccount()),[errors,setErrors]=useState({}),[confirmId,setConfirmId]=useState(null);
  const openNew=()=>{setForm(emptyAccount());setErrors({});setModal(true)}; const openEdit=a=>{setForm({id:a.id,name:a.name,institution:a.institution||"",type:a.type||"corrente",color:a.color||ACCOUNT_COLORS[0]});setErrors({});setModal(true)};
  const save=()=>{const e={};if(!safeString(form.name).trim())e.name="Nome obrigatório";setErrors(e);if(Object.keys(e).length)return;setData(d=>({...d,accounts:form.id?d.accounts.map(a=>a.id===form.id?{...a,name:form.name.trim(),institution:form.institution,type:form.type,color:form.color}:a):[...d.accounts,{id:uid(),name:form.name.trim(),institution:form.institution,type:form.type,color:form.color}]}));toast(form.id?"Conta atualizada.":"Conta adicionada.");setModal(false)};
  const remove=id=>{setData(d=>({...d,accounts:d.accounts.filter(a=>a.id!==id)}));toast("Conta removida.");setConfirmId(null)};
  return <div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}><button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15}/> Nova conta</button></div>{data.accounts.length===0?<EmptyState icon={Landmark} title="Nenhuma conta cadastrada" description="Cadastre suas contas bancárias, carteiras e dinheiro em espécie." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={14}/> Nova conta</button>}/>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>{data.accounts.map(a=><div key={a.id} className="mf-card" style={{padding:18}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:34,height:34,borderRadius:9,background:a.color}}/><div><div style={{fontWeight:700,fontSize:14.5}}>{a.name}</div><div style={{fontSize:11.5,color:"var(--text-faint)"}}>{a.institution||"—"}</div></div></div><div style={{display:"flex",gap:4}}><IconBtn onClick={()=>openEdit(a)}><Pencil size={13}/></IconBtn><IconBtn onClick={()=>setConfirmId(a.id)} danger><Trash2 size={13}/></IconBtn></div></div><div className="mf-label" style={{margin:0}}>Saldo atual</div><Money cents={fin.accountBalance(a.id)} size={22} weight={700}/></div>)}</div>}
  <Modal open={modal} onClose={()=>setModal(false)} title={form.id?"Editar conta":"Nova conta"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button></>}><Field label="Nome"><input className="mf-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>{errors.name&&<ErrorText>{errors.name}</ErrorText>}</Field><Field label="Instituição"><input className="mf-input" value={form.institution} onChange={e=>setForm(f=>({...f,institution:e.target.value}))}/></Field><Field label="Tipo"><select className="mf-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="corrente">Conta corrente</option><option value="poupanca">Poupança</option><option value="carteira">Carteira</option><option value="dinheiro">Dinheiro</option></select></Field><Field label="Cor"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{ACCOUNT_COLORS.map(c=><button key={c} className="mf-focus" onClick={()=>setForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"3px solid var(--text)":"2px solid transparent",cursor:"pointer"}}/>)}</div></Field></Modal><ConfirmDialog open={!!confirmId} title="Excluir conta" message={`Excluir "${data.accounts.find(a=>a.id===confirmId)?.name||""}"? As movimentações continuarão registradas.`} onCancel={()=>setConfirmId(null)} onConfirm={()=>remove(confirmId)}/></div>;
}

function emptyBill() {
  return { id: null, name: "", value: "", dueDate: isoToday(), categoryId: "", accountId: "" };
}

function Bills({ data, setData }) {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyBill());
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [filter, setFilter] = useState("pending");
  const currentMonth = getActiveMonth(data);

  const openNew = () => { setForm({ ...emptyBill(), dueDate: getActiveMonth(data) + "-01" }); setErrors({}); setModal(true); };
  const openEdit = (b) => { setForm({ ...b, value: (safeCents(b.valueCents) / 100).toFixed(2).replace(".", ",") }); setErrors({}); setModal(true); };

  const save = () => {
    const e = {};
    if (!safeString(form.name).trim()) e.name = "Nome obrigatório";
    if (toCents(form.value) <= 0) e.value = "Valor deve ser maior que zero";
    if (!form.dueDate) e.dueDate = "Vencimento obrigatório";
    if (!form.categoryId) e.categoryId = "Selecione a categoria";
    if (!form.accountId) e.accountId = "Selecione uma conta";
    setErrors(e);
    if (Object.keys(e).length) return;

    const valueCents = toCents(form.value);
    setData((d) => ({
      ...d,
      bills: form.id
        ? d.bills.map((b) => b.id === form.id ? { ...b, name: form.name.trim(), valueCents, dueDate: form.dueDate, categoryId: form.categoryId, accountId: form.accountId } : b)
        : [...d.bills, {
            id: uid(), name: form.name.trim(), valueCents, dueDate: form.dueDate,
            categoryId: form.categoryId, accountId: form.accountId, status: "pending",
            fixed: false, recurrence: "none", fixedAccountId: null, occurrenceKey: null,
            paidDate: null, paymentId: null, paymentAccountId: form.accountId,
          }],
    }));
    toast(form.id ? "Conta atualizada." : "Conta adicionada.");
    setModal(false);
  };

  const remove = (id) => {
    setData((d) => ({ ...d, bills: d.bills.filter((b) => b.id !== id) }));
    toast("Conta removida.");
    setConfirmId(null);
  };

  const togglePayment = (id) => {
    setData((d) => {
      const bill = d.bills.find((b) => b.id === id);
      if (!bill) return d;
      if (bill.status === "paid") {
        return { ...d, bills: d.bills.map((b) => b.id === id ? { ...b, status: "pending", paidDate: null, paymentId: null } : b) };
      }
      return {
        ...d,
        bills: d.bills.map((b) => b.id === id ? {
          ...b, status: "paid", paidDate: isoToday(), paymentId: b.paymentId || uid(), paymentAccountId: b.paymentAccountId || b.accountId || "",
        } : b),
      };
    });
    toast("Status da conta atualizado.");
  };

  const list = useMemo(() => [...data.bills]
    .filter((b) => monthKeyOf(b.dueDate) === currentMonth)
    .filter((b) => filter === "all" || b.status === filter)
    .sort((a, b) => a.dueDate < b.dueDate ? -1 : 1), [data.bills, currentMonth, filter]);

  return (
    <div className="mf-anim-in">
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <SegTabs value={filter} onChange={setFilter} options={[{ value: "pending", label: "Pendentes" }, { value: "paid", label: "Pagas" }, { value: "all", label: "Todas" }]} />
        <button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15} /> Nova conta a pagar</button>
      </div>

      {list.length === 0 ? <EmptyState icon={Landmark} title="Nenhuma conta encontrada" description="Cadastre contas a pagar e gerencie os pagamentos." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={14} /> Nova conta a pagar</button>} /> :
        <div className="mf-card" style={{ overflow: "hidden" }}>
          {list.map((b, idx) => {
            const cat = data.categories.find((c) => c.id === b.categoryId);
            const acc = data.accounts.find((a) => a.id === b.accountId);
            return <div key={b.id} className={b.status === "paid" ? "mf-bill-paid" : ""} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: idx === 0 ? "none" : "1px solid var(--border)", flexWrap: "wrap" }}>
              <IconBadge icon={cat?.icon || "💰"} color={cat?.color || "#888"} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {b.name}
                  {b.fixed && <Badge color="var(--text-faint)">fixa</Badge>}
                  {b.status === "paid" && <Badge color="var(--income)">✓ paga</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>vence {fmtDateBR(b.dueDate)} · {cat?.name || "—"} · {acc?.name || "—"}</div>
              </div>
              <Money cents={b.valueCents} weight={700} />
              {b.status === "pending"
                ? <button className="mf-btn mf-btn-primary mf-focus" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => togglePayment(b.id)}>Marcar como paga</button>
                : <button className="mf-btn mf-btn-ghost mf-focus" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => togglePayment(b.id)}>Marcar como pendente</button>}
              <IconBtn onClick={() => openEdit(b)}><Pencil size={13} /></IconBtn>
              <IconBtn onClick={() => setConfirmId(b.id)} danger><Trash2 size={13} /></IconBtn>
            </div>;
          })}
        </div>}

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "Editar conta" : "Nova conta a pagar"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button></>}>
        <Field label="Nome"><input className="mf-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Aluguel" />{errors.name && <ErrorText>{errors.name}</ErrorText>}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Valor (R$)"><input className="mf-input" inputMode="decimal" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00" />{errors.value && <ErrorText>{errors.value}</ErrorText>}</Field>
          <Field label="Vencimento"><input className="mf-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />{errors.dueDate && <ErrorText>{errors.dueDate}</ErrorText>}</Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Categoria"><select className="mf-input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}><option value="">Selecione…</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>{errors.categoryId && <ErrorText>{errors.categoryId}</ErrorText>}</Field>
          <Field label="Conta"><select className="mf-input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}><option value="">Selecione…</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{errors.accountId && <ErrorText>{errors.accountId}</ErrorText>}</Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmId} title="Excluir conta" message={`Excluir "${data.bills.find(b => b.id === confirmId)?.name || ""}"?`} onCancel={() => setConfirmId(null)} onConfirm={() => remove(confirmId)} />
    </div>
  );
}

function FixedAccounts({ data, setData }) {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", value: "", dueDay: 1, categoryId: "", accountId: "", recurrence: "monthly", startDate: isoToday(), active: true });
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const month = getActiveMonth(data);

  const openNew = () => {
    setForm({ id: null, name: "", value: "", dueDay: new Date().getDate(), categoryId: data.categories[0]?.id || "", accountId: data.accounts[0]?.id || "", recurrence: "monthly", startDate: isoToday(), active: true });
    setErrors({}); setModal(true);
  };

  const openEdit = (f) => {
    setForm({ ...f, value: (safeCents(f.valueCents) / 100).toFixed(2).replace(".", ",") });
    setErrors({}); setModal(true);
  };

  const save = () => {
    const e = {};
    if (!safeString(form.name).trim()) e.name = "Nome obrigatório";
    if (toCents(form.value) <= 0) e.value = "Valor inválido";
    if (+form.dueDay < 1 || +form.dueDay > 31) e.dueDay = "Dia inválido";
    if (!form.categoryId) e.categoryId = "Selecione a categoria";
    if (!form.accountId) e.accountId = "Selecione uma conta";
    setErrors(e); if (Object.keys(e).length) return;

    const f = {
      id: form.id || uid(), name: form.name.trim(), valueCents: toCents(form.value), dueDay: +form.dueDay,
      categoryId: form.categoryId, accountId: form.accountId, recurrence: form.recurrence,
      startDate: form.startDate || isoToday(), active: form.active !== false,
    };

    setData((d) => {
      const fixed = form.id ? (d.fixedAccounts || []).map(x => x.id === form.id ? f : x) : [...(d.fixedAccounts || []), f];
      return ensureFixedOccurrences({ ...d, fixedAccounts: fixed }, month);
    });
    toast(form.id ? "Conta fixa atualizada." : "Conta fixa criada.");
    setModal(false);
  };

  const toggleActive = (f) => {
    setData((d) => ({ ...d, fixedAccounts: (d.fixedAccounts || []).map(x => x.id === f.id ? { ...x, active: !x.active } : x) }));
    toast(f.active ? "Recorrência pausada." : "Recorrência ativada.");
  };

  const toggleOccurrence = (fixedId) => {
    setData((d) => {
      const occurrence = d.bills.find(b => b.fixedAccountId === fixedId && b.occurrenceKey === occurrenceKey(fixedId, month));
      if (!occurrence) return ensureFixedOccurrences(d, month);
      if (occurrence.status === "paid") {
        return { ...d, bills: d.bills.map(b => b.id === occurrence.id ? { ...b, status: "pending", paidDate: null, paymentId: null } : b) };
      }
      return { ...d, bills: d.bills.map(b => b.id === occurrence.id ? { ...b, status: "paid", paidDate: isoToday(), paymentId: b.paymentId || uid(), paymentAccountId: b.paymentAccountId || b.accountId || "" } : b) };
    });
    toast("Status da ocorrência atualizado.");
  };

  const remove = (id) => {
    setData(d => ({ ...d, fixedAccounts: (d.fixedAccounts || []).filter(f => f.id !== id) }));
    toast("Conta fixa removida. Ocorrências já criadas continuam no histórico.");
    setConfirmId(null);
  };

  const rows = data.fixedAccounts || [];

  return <div className="mf-anim-in">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <div>
        <div className="mf-display" style={{ fontSize: 15.5, fontWeight: 600 }}>Modelos recorrentes</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>O modelo é a recorrência. O pagamento pertence à ocorrência do mês.</div>
      </div>
      <button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15} /> Nova conta fixa</button>
    </div>

    {rows.length === 0 ? <EmptyState icon={Landmark} title="Nenhuma conta fixa" description="Cadastre modelos recorrentes como aluguel, internet e luz." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={14} /> Nova conta fixa</button>} /> :
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(f => {
          const occ = data.bills.find(b => b.fixedAccountId === f.id && b.occurrenceKey === occurrenceKey(f.id, month));
          const paid = occ?.status === "paid";
          return <div key={f.id} className="mf-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <IconBadge icon="🔁" color="var(--brand-2)" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {f.name}
                <Badge color={paid ? "var(--income)" : "var(--text-faint)"}>{paid ? "Paga" : "Pendente"}</Badge>
                <Badge color={f.active ? "var(--brand-2)" : "var(--text-faint)"}>{f.active ? "Recorrência ativa" : "Recorrência pausada"}</Badge>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>
                R$ {(safeCents(f.valueCents) / 100).toFixed(2).replace(".", ",")} · todo dia {f.dueDay}
                {monthKeyOf(f.startDate || isoToday()) > month ? ` · começa em ${fmtDateBR(f.startDate)}` : ` · competência ${monthLabel(month)}`}
              </div>
            </div>
            <Money cents={f.valueCents} weight={700} />
            {f.active && <button className={`mf-btn ${paid ? "mf-btn-ghost" : "mf-btn-primary"} mf-focus`} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggleOccurrence(f.id)}>{paid ? "Marcar como pendente" : "Marcar como paga"}</button>}
            <button className="mf-btn mf-btn-ghost mf-focus" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggleActive(f)}>{f.active ? "Pausar recorrência" : "Ativar recorrência"}</button>
            <IconBtn onClick={() => openEdit(f)}><Pencil size={13} /></IconBtn>
            <IconBtn onClick={() => setConfirmId(f.id)} danger><Trash2 size={13} /></IconBtn>
          </div>;
        })}
      </div>}

    <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "Editar conta fixa" : "Nova conta fixa"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button></>}>
      <Field label="Nome"><input className="mf-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Aluguel" />{errors.name && <ErrorText>{errors.name}</ErrorText>}</Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Valor (R$)"><input className="mf-input" inputMode="decimal" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="1.100,00" />{errors.value && <ErrorText>{errors.value}</ErrorText>}</Field>
        <Field label="Dia de vencimento"><input className="mf-input" type="number" min="1" max="31" value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} />{errors.dueDay && <ErrorText>{errors.dueDay}</ErrorText>}</Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Categoria"><select className="mf-input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}><option value="">Selecione…</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>{errors.categoryId && <ErrorText>{errors.categoryId}</ErrorText>}</Field>
        <Field label="Conta para pagamento"><select className="mf-input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}><option value="">Selecione…</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{errors.accountId && <ErrorText>{errors.accountId}</ErrorText>}</Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Recorrência"><select className="mf-input" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></Field>
        <Field label="Começar em"><input className="mf-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
      </div>
    </Modal>
    <ConfirmDialog open={!!confirmId} title="Excluir conta fixa" message="Excluir o modelo recorrente? As ocorrências já criadas permanecem no histórico." onCancel={() => setConfirmId(null)} onConfirm={() => remove(confirmId)} />
  </div>;
}

/* =========================================================================
   PLANEJAMENTO — recebimentos previstos e compromissos
   ========================================================================= */

function emptyReceipt() {
  return { id: null, name: "", value: "", day: 1, recurrence: "monthly", startDate: isoToday(), active: true };
}

function Planning({ data, setData }) {
  const toast = useToast();
  const month = getActiveMonth(data);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyReceipt());
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);

  const receipts = Array.isArray(data.recurringReceipts) ? data.recurringReceipts : [];
  const monthStart = month + "-01";
  const monthEnd = monthEndISO(month);

  const upcomingReceipts = useMemo(() => receipts
    .filter(r => r.active !== false && monthKeyOf(r.startDate || monthStart) <= month)
    .filter(r => r.recurrence !== "yearly" || (r.startDate || monthStart).slice(5) === month.slice(5))
    .map(r => ({ ...r, date: dueDateForMonth(month, r.day) }))
    .sort((a,b) => a.date < b.date ? -1 : 1), [receipts, month]);

  const upcomingBills = useMemo(() => (data.bills || [])
    .filter(b => monthKeyOf(b.dueDate) === month && b.status === "pending")
    .sort((a,b) => a.dueDate < b.dueDate ? -1 : 1), [data.bills, month]);

  const openNew = () => {
    setForm({ ...emptyReceipt(), day: 15, value: "" });
    setErrors({});
    setModal(true);
  };
  const openEdit = r => {
    setForm({ ...r, value: (safeCents(r.valueCents) / 100).toFixed(2).replace(".", ",") });
    setErrors({});
    setModal(true);
  };
  const save = () => {
    const e = {};
    if (!safeString(form.name).trim()) e.name = "Nome obrigatório";
    if (toCents(form.value) <= 0) e.value = "Valor inválido";
    if (+form.day < 1 || +form.day > 31) e.day = "Dia inválido";
    if (!form.startDate) e.startDate = "Data inicial obrigatória";
    setErrors(e);
    if (Object.keys(e).length) return;
    const receipt = {
      id: form.id || uid(),
      name: form.name.trim(),
      valueCents: toCents(form.value),
      day: +form.day,
      recurrence: form.recurrence === "yearly" ? "yearly" : "monthly",
      startDate: form.startDate,
      active: form.active !== false,
    };
    setData(d => ({ ...d, recurringReceipts: form.id
      ? (d.recurringReceipts || []).map(r => r.id === form.id ? receipt : r)
      : [...(d.recurringReceipts || []), receipt]
    }));
    toast(form.id ? "Recebimento atualizado." : "Recebimento planejado.");
    setModal(false);
  };
  const toggle = r => {
    setData(d => ({ ...d, recurringReceipts: (d.recurringReceipts || []).map(x => x.id === r.id ? { ...x, active: !x.active } : x) }));
    toast(r.active === false ? "Recebimento ativado." : "Recebimento pausado.");
  };
  const remove = id => {
    setData(d => ({ ...d, recurringReceipts: (d.recurringReceipts || []).filter(r => r.id !== id) }));
    toast("Recebimento removido.");
    setConfirmId(null);
  };

  return (
    <div className="mf-anim-in">
      <div className="mf-card" style={{ padding: 18, marginBottom: 14 }}>
        <SectionTitle title={`Planejamento · ${fullMonthLabel(month)}`} subtitle="Cadastre quando o dinheiro costuma entrar. Isso é uma previsão e não altera o saldo nem cria uma transação automaticamente." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15}/> Novo recebimento</button>} />
        {upcomingReceipts.length === 0 ? <EmptyState icon={ArrowUpCircle} title="Nenhum recebimento planejado" description="Cadastre salário, vale, comissão ou outra entrada recorrente." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {upcomingReceipts.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                <IconBadge icon="💰" color="var(--income)" />
                <div style={{ flex: 1, minWidth: 150 }}><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>previsto para {fmtDateBR(r.date)} · {r.recurrence === "yearly" ? "anual" : "mensal"}</div></div>
                <Money cents={r.valueCents} weight={700} />
                <IconBtn onClick={() => openEdit(r)}><Pencil size={13}/></IconBtn>
                <IconBtn onClick={() => toggle(r)}><Check size={13}/></IconBtn>
                <IconBtn onClick={() => setConfirmId(r.id)} danger><Trash2 size={13}/></IconBtn>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mf-card" style={{ padding: 18 }}>
        <SectionTitle title="Contas previstas" subtitle="As contas fixas continuam recorrentes e as demais pertencem somente ao mês em que foram lançadas." />
        {upcomingBills.length === 0 ? <EmptyState icon={Landmark} title="Nenhuma conta pendente" description="As contas do mês aparecem aqui sem serem duplicadas." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {upcomingBills.map(b => <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)" }}><IconBadge icon="📅" color="var(--expense)"/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700}}>{b.name}</div><div style={{fontSize:11.5,color:"var(--text-faint)"}}>vence {fmtDateBR(b.dueDate)}{b.fixed ? " · fixa" : ""}</div></div><Money cents={b.valueCents} weight={700}/></div>)}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "Editar recebimento" : "Novo recebimento"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button></>}>
        <Field label="Nome"><input className="mf-input" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="Ex: Salário" />{errors.name && <ErrorText>{errors.name}</ErrorText>}</Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Valor previsto (R$)"><input className="mf-input" inputMode="decimal" value={form.value} onChange={e => setForm(f => ({...f,value:e.target.value}))} placeholder="1.250,00" />{errors.value && <ErrorText>{errors.value}</ErrorText>}</Field>
          <Field label="Dia do recebimento"><input className="mf-input" type="number" min="1" max="31" value={form.day} onChange={e => setForm(f => ({...f,day:e.target.value}))} />{errors.day && <ErrorText>{errors.day}</ErrorText>}</Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Recorrência"><select className="mf-input" value={form.recurrence} onChange={e => setForm(f => ({...f,recurrence:e.target.value}))}><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></Field>
          <Field label="Começar em"><input className="mf-input" type="date" value={form.startDate} onChange={e => setForm(f => ({...f,startDate:e.target.value}))}/>{errors.startDate && <ErrorText>{errors.startDate}</ErrorText>}</Field>
        </div>
        <div style={{fontSize:12,color:"var(--text-faint)"}}>Exemplo: você pode cadastrar um recebimento para o dia 12 e outro para o dia 27. Eles ficam como previsão e só viram entrada quando você registrar a transação de fato.</div>
      </Modal>
      <ConfirmDialog open={!!confirmId} title="Excluir recebimento" message={`Excluir "${receipts.find(r => r.id === confirmId)?.name || ""}" do planejamento?`} onCancel={() => setConfirmId(null)} onConfirm={() => remove(confirmId)} />
    </div>
  );
}

function invoiceMonthFor(purchaseDateISO, closingDay, offset) { const d=parseISO(purchaseDateISO); let base=new Date(d.getFullYear(),d.getMonth(),1); if(d.getDate()>Number(closingDay)) base=new Date(base.getFullYear(),base.getMonth()+1,1); const target=new Date(base.getFullYear(),base.getMonth()+offset,1); return target.getFullYear()+"-"+String(target.getMonth()+1).padStart(2,"0"); }
function computeInvoices(card,purchases){const map={};for(const p of purchases.filter(p=>p.cardId===card.id)){const installments=Math.max(1,Number(p.installments)||1);for(let k=0;k<installments;k++){const mk=invoiceMonthFor(p.date,card.closingDay,k);if(!map[mk])map[mk]={total:0,items:[]};map[mk].total+=safeCents(p.installmentValueCents);map[mk].items.push({purchase:p,n:k+1});}}return map;}
function emptyCard(){return{id:null,name:"",institution:"",limit:"",closingDay:10,dueDay:17,color:ACCOUNT_COLORS[0],active:true};} function emptyPurchase(){return{id:null,description:"",value:"",cardId:"",categoryId:"",date:isoToday(),installments:1,note:""};}
function Cards({data,setData,quickAction,clearQuickAction}){
 const toast=useToast(); const [cardModal,setCardModal]=useState(false),[cardForm,setCardForm]=useState(emptyCard()),[cardErrors,setCardErrors]=useState({}),[confirmCardId,setConfirmCardId]=useState(null),[purchaseModal,setPurchaseModal]=useState(false),[purchaseForm,setPurchaseForm]=useState(emptyPurchase()),[purchaseErrors,setPurchaseErrors]=useState({}),[confirmPurchaseId,setConfirmPurchaseId]=useState(null),[expandedCard,setExpandedCard]=useState(data.cards[0]?.id||null),[payModal,setPayModal]=useState(null),[payAccount,setPayAccount]=useState(""); const paying=useRef(false); const currentMonth=getActiveMonth(data);
 useEffect(() => {
  if (quickAction === "cardExpense") {
    openNewPurchase(data.cards[0]?.id || "");
    clearQuickAction?.();
  }
 }, [quickAction]);
 const openNewCard=()=>{setCardForm(emptyCard());setCardErrors({});setCardModal(true)}; const openEditCard=c=>{setCardForm({...c,limit:(safeCents(c.limitCents)/100).toFixed(2).replace(".",",")});setCardErrors({});setCardModal(true)};
 const saveCard=()=>{const e={};if(!safeString(cardForm.name).trim())e.name="Nome obrigatório";if(+cardForm.closingDay<1||+cardForm.closingDay>31)e.closingDay="Dia inválido";if(+cardForm.dueDay<1||+cardForm.dueDay>31)e.dueDay="Dia inválido";setCardErrors(e);if(Object.keys(e).length)return;const c={id:cardForm.id||uid(),name:cardForm.name.trim(),institution:cardForm.institution,limitCents:toCents(cardForm.limit),closingDay:+cardForm.closingDay,dueDay:+cardForm.dueDay,color:cardForm.color,active:true};setData(d=>({...d,cards:cardForm.id?d.cards.map(x=>x.id===cardForm.id?c:x):[...d.cards,c]}));toast(cardForm.id?"Cartão atualizado.":"Cartão adicionado.");setCardModal(false)};
 const removeCard=id=>{setData(d=>({...d,cards:d.cards.filter(c=>c.id!==id),cardPurchases:d.cardPurchases.filter(p=>p.cardId!==id)}));toast("Cartão removido.");setConfirmCardId(null)};
 const openNewPurchase=cardId=>{setPurchaseForm({...emptyPurchase(),cardId,date:currentMonth+"-01"});setPurchaseErrors({});setPurchaseModal(true)}; const openEditPurchase=p=>{setPurchaseForm({...p,value:(safeCents(p.valueCents)/100).toFixed(2).replace(".",",")});setPurchaseErrors({});setPurchaseModal(true)};
 const savePurchase=()=>{const e={};if(!safeString(purchaseForm.description).trim())e.description="Descrição obrigatória";if(toCents(purchaseForm.value)<=0)e.value="Valor inválido";if(!purchaseForm.categoryId)e.categoryId="Selecione a categoria";if(+purchaseForm.installments<1)e.installments="Mínimo 1 parcela";setPurchaseErrors(e);if(Object.keys(e).length)return;const valueCents=toCents(purchaseForm.value),n=Math.max(1,+purchaseForm.installments||1),iv=Math.floor(valueCents/n),remainder=valueCents-iv*n;setData(d=>{const item={id:purchaseForm.id||uid(),description:purchaseForm.description.trim(),valueCents,cardId:purchaseForm.cardId,categoryId:purchaseForm.categoryId,date:purchaseForm.date,installments:n,installmentValueCents:iv,note:purchaseForm.note||"",remainderCents:remainder};return {...d,cardPurchases:purchaseForm.id?d.cardPurchases.map(p=>p.id===purchaseForm.id?item:p):[...d.cardPurchases,item]}});toast(purchaseForm.id?"Compra atualizada.":"Compra registrada.");setPurchaseModal(false)};
 const removePurchase=id=>{setData(d=>({...d,cardPurchases:d.cardPurchases.filter(p=>p.id!==id)}));toast("Compra removida.");setConfirmPurchaseId(null)};
 const payInvoice=()=>{if(paying.current||!payModal||!payAccount)return;paying.current=true;setData(d=>{const key=`${payModal.cardId}-${payModal.monthKey}`;if(d.invoicePayments?.[key])return d;const card=d.cards.find(c=>c.id===payModal.cardId);if(!card)return d;const txId=uid();return {...d,transactions:[...d.transactions,{id:txId,description:`Fatura ${card.name} — ${monthLabel(payModal.monthKey)}`,valueCents:payModal.total,type:"expense",categoryId:"cat-cartao",accountId:payAccount,date:isoToday(),status:"paid",note:"Pagamento de fatura",transfer:false,invoicePaymentKey:key}],invoicePayments:{...(d.invoicePayments||{}),[key]:{transactionId:txId,paidDate:isoToday(),accountId:payAccount}}}});setPayModal(null);paying.current=false;toast("Fatura paga.")};
 const unpayInvoice=(cardId,mk)=>{setData(d=>{const key=`${cardId}-${mk}`,p=d.invoicePayments?.[key];if(!p)return d;return {...d,transactions:d.transactions.filter(t=>t.id!==p.transactionId),invoicePayments:Object.fromEntries(Object.entries(d.invoicePayments||{}).filter(([k])=>k!==key))}});toast("Pagamento da fatura desfeito.")};
 return <div className="mf-anim-in"><div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}><button className="mf-btn mf-btn-primary mf-focus" onClick={openNewCard}><Plus size={15}/> Novo cartão</button></div>{data.cards.length===0?<EmptyState icon={CreditCard} title="Nenhum cartão cadastrado" description="Adicione seus cartões de crédito para acompanhar faturas e compras." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNewCard}><Plus size={14}/> Novo cartão</button>}/>:<div style={{display:"flex",flexDirection:"column",gap:14}}>{data.cards.map(card=>{const purchases=data.cardPurchases.filter(p=>p.cardId===card.id),invoices=computeInvoices(card,data.cardPurchases),inv=invoices[currentMonth]||{total:0,items:[]},key=`${card.id}-${currentMonth}`,paid=data.invoicePayments?.[key],usedCents=purchases.reduce((sum,p)=>sum+safeCents(p.valueCents),0),isOpen=expandedCard===card.id;return <div key={card.id} className="mf-card" style={{padding:18}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,cursor:"pointer",flexWrap:"wrap"}} onClick={()=>setExpandedCard(isOpen?null:card.id)}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:28,borderRadius:6,background:`linear-gradient(135deg, ${card.color}, ${card.color}99)`}}/><div><div style={{fontWeight:700,fontSize:15}}>{card.name}</div><div style={{fontSize:11.5,color:"var(--text-faint)"}}>{card.institution||"—"} · fecha dia {card.closingDay} · vence dia {card.dueDay}</div></div></div><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--text-faint)"}}>Limite disponível</div><Money cents={Math.max(0,card.limitCents-usedCents)} weight={700}/></div><div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}><IconBtn onClick={()=>openEditCard(card)}><Pencil size={13}/></IconBtn><IconBtn onClick={()=>setConfirmCardId(card.id)} danger><Trash2 size={13}/></IconBtn></div>{isOpen?<ChevronLeft style={{transform:"rotate(-90deg)"}} size={16}/>:<ChevronRight size={16}/>}</div></div>{isOpen&&<div style={{marginTop:18,paddingTop:16,borderTop:"1px solid var(--border)"}}><SectionTitle title={`Fatura atual · ${monthLabel(currentMonth)}`} action={<LinkBtn onClick={()=>openNewPurchase(card.id)}>+ Nova compra</LinkBtn>}/><div className="mf-card" style={{padding:14,background:"var(--surface-2)",marginBottom:18}}><div style={{fontSize:11.5,color:"var(--text-faint)",marginBottom:4}}>Competência {monthLabel(currentMonth)}</div><Money cents={inv.total} size={21} weight={700}/><div style={{fontSize:11.5,color:"var(--text-faint)",margin:"6px 0 10px"}}>{inv.items.length} {inv.items.length===1?"lançamento":"lançamentos"} nesta fatura</div>{paid?<div style={{display:"flex",gap:8,alignItems:"center"}}><Badge color="var(--income)">Paga</Badge><button className="mf-btn mf-btn-ghost mf-focus" style={{padding:"5px 9px",fontSize:11.5}} onClick={()=>unpayInvoice(card.id,currentMonth)}>Desmarcar como paga</button></div>:<button className="mf-btn mf-btn-primary mf-focus" disabled={inv.total<=0} onClick={()=>{setPayModal({cardId:card.id,monthKey:currentMonth,total:inv.total});setPayAccount(data.accounts[0]?.id||"")}}>Pagar fatura</button>}</div><SectionTitle title="Compras no cartão"/><div style={{display:"flex",flexDirection:"column",gap:8}}>{purchases.length===0?<EmptyState icon={CreditCard} title="Nenhuma compra registrada" description="Registre as compras feitas neste cartão."/>:purchases.slice().sort((a,b)=>a.date<b.date?1:-1).map(p=>{const cat=data.categories.find(c=>c.id===p.categoryId);return <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:"1px solid var(--border)"}}><IconBadge icon={cat?.icon||"💳"} color={cat?.color||"#888"}/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13.5}}>{p.description}</div><div style={{fontSize:11.5,color:"var(--text-faint)"}}>{fmtDateBR(p.date)} · {p.installments}x de {brl(p.installmentValueCents)}</div></div><Money cents={p.valueCents} weight={700}/><div style={{display:"flex",gap:4}}><IconBtn onClick={()=>openEditPurchase(p)}><Pencil size={13}/></IconBtn><IconBtn onClick={()=>setConfirmPurchaseId(p.id)} danger><Trash2 size={13}/></IconBtn></div></div>})}</div></div>}</div>})}</div>}
 <Modal open={cardModal} onClose={()=>setCardModal(false)} title={cardForm.id?"Editar cartão":"Novo cartão"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setCardModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={saveCard}>Salvar</button></>}><Field label="Nome"><input className="mf-input" value={cardForm.name} onChange={e=>setCardForm(f=>({...f,name:e.target.value}))}/>{cardErrors.name&&<ErrorText>{cardErrors.name}</ErrorText>}</Field><Field label="Instituição"><input className="mf-input" value={cardForm.institution} onChange={e=>setCardForm(f=>({...f,institution:e.target.value}))}/></Field><Field label="Limite (R$)"><input className="mf-input" inputMode="decimal" value={cardForm.limit} onChange={e=>setCardForm(f=>({...f,limit:e.target.value}))}/></Field><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Field label="Dia de fechamento"><input className="mf-input" type="number" value={cardForm.closingDay} onChange={e=>setCardForm(f=>({...f,closingDay:e.target.value}))}/></Field><Field label="Dia de vencimento"><input className="mf-input" type="number" value={cardForm.dueDay} onChange={e=>setCardForm(f=>({...f,dueDay:e.target.value}))}/></Field></div><Field label="Cor"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{ACCOUNT_COLORS.map(c=><button key={c} className="mf-focus" onClick={()=>setCardForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:cardForm.color===c?"3px solid var(--text)":"2px solid transparent",cursor:"pointer"}}/>)}</div></Field></Modal>
 <Modal open={purchaseModal} onClose={()=>setPurchaseModal(false)} title={purchaseForm.id?"Editar compra":"Nova compra"} footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setPurchaseModal(false)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={savePurchase}>Salvar</button></>}><Field label="Descrição"><input className="mf-input" value={purchaseForm.description} onChange={e=>setPurchaseForm(f=>({...f,description:e.target.value}))}/>{purchaseErrors.description&&<ErrorText>{purchaseErrors.description}</ErrorText>}</Field><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Field label="Valor total (R$)"><input className="mf-input" inputMode="decimal" value={purchaseForm.value} onChange={e=>setPurchaseForm(f=>({...f,value:e.target.value}))}/>{purchaseErrors.value&&<ErrorText>{purchaseErrors.value}</ErrorText>}</Field><Field label="Data"><input className="mf-input" type="date" value={purchaseForm.date} onChange={e=>setPurchaseForm(f=>({...f,date:e.target.value}))}/></Field></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Field label="Categoria"><select className="mf-input" value={purchaseForm.categoryId} onChange={e=>setPurchaseForm(f=>({...f,categoryId:e.target.value}))}><option value="">Selecione…</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>{purchaseErrors.categoryId&&<ErrorText>{purchaseErrors.categoryId}</ErrorText>}</Field><Field label="Parcelas"><input className="mf-input" type="number" min="1" value={purchaseForm.installments} onChange={e=>setPurchaseForm(f=>({...f,installments:e.target.value}))}/>{purchaseErrors.installments&&<ErrorText>{purchaseErrors.installments}</ErrorText>}</Field></div>{purchaseForm.value&&purchaseForm.installments>0&&<div style={{fontSize:12.5,color:"var(--text-muted)"}}>{purchaseForm.installments}x de <Money cents={Math.floor(toCents(purchaseForm.value)/(purchaseForm.installments||1))} size={13}/></div>}</Modal>
 <Modal open={!!payModal} onClose={()=>setPayModal(null)} title="Pagar fatura" footer={<><button className="mf-btn mf-btn-ghost mf-focus" onClick={()=>setPayModal(null)}>Cancelar</button><button className="mf-btn mf-btn-primary mf-focus" onClick={payInvoice}>Confirmar pagamento</button></>}><p style={{fontSize:14}}>Fatura de <b>{payModal&&monthLabel(payModal.monthKey)}</b>: <Money cents={payModal?.total||0} weight={700}/></p><Field label="Pagar com a conta"><select className="mf-input" value={payAccount} onChange={e=>setPayAccount(e.target.value)}>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></Modal><ConfirmDialog open={!!confirmCardId} title="Excluir cartão" message="Excluir este cartão e suas compras?" onCancel={()=>setConfirmCardId(null)} onConfirm={()=>removeCard(confirmCardId)}/><ConfirmDialog open={!!confirmPurchaseId} title="Excluir compra" message="Excluir esta compra do cartão?" onCancel={()=>setConfirmPurchaseId(null)} onConfirm={()=>removePurchase(confirmPurchaseId)}/></div>;
}

/* =========================================================================
   INVESTIMENTOS
   ========================================================================= */

const INVEST_CATEGORIES = ["Renda fixa", "Ações", "Fundos", "Cripto", "ETFs", "Poupança", "Outros"];
const INVEST_COLORS = { "Renda fixa": "#2FAE7C", "Ações": "#3EA6D9", "Fundos": "#C9A227", "Cripto": "#DC5B4B", "ETFs": "#7C8CF8", "Poupança": "#8C97AD", "Outros": "#C96FE0" };

function emptyInvestment() { return { id: null, name: "", category: INVEST_CATEGORIES[0], institution: "", invested: "", current: "", date: isoToday(), note: "" }; }

function Investments({ data, setData }) {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyInvestment());
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);

  const openNew = () => { setForm(emptyInvestment()); setErrors({}); setModal(true); };

  const openEditFix = (inv) => {
    setForm({ ...inv, invested: (inv.investedCents / 100).toFixed(2).replace(".", ","), current: (inv.currentCents / 100).toFixed(2).replace(".", ",") });
    setErrors({});
    setModal(true);
  };

  const save = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nome obrigatório";
    if (toCents(form.invested) < 0) e.invested = "Valor inválido";
    if (toCents(form.current) < 0) e.current = "Valor inválido";
    setErrors(e);
    if (Object.keys(e).length) return;
    const investedCents = toCents(form.invested || "0");
    const currentCents = toCents(form.current || "0");
    if (form.id) {
      setData((d) => ({ ...d, investments: d.investments.map((i) => i.id === form.id ? { ...i, name: form.name.trim(), category: form.category, institution: form.institution, investedCents, currentCents, date: form.date, note: form.note } : i) }));
      toast("Investimento atualizado.");
    } else {
      setData((d) => ({ ...d, investments: [...d.investments, { id: uid(), name: form.name.trim(), category: form.category, institution: form.institution, investedCents, currentCents, date: form.date, note: form.note }] }));
      toast("Investimento adicionado.");
    }
    setModal(false);
  };

  const remove = (id) => { setData((d) => ({ ...d, investments: d.investments.filter((i) => i.id !== id) })); toast("Investimento removido."); setConfirmId(null); };

  const totals = useMemo(() => {
    const invested = data.investments.reduce((s, i) => s + i.investedCents, 0);
    const current = data.investments.reduce((s, i) => s + i.currentCents, 0);
    const profit = current - invested;
    const roi = invested > 0 ? (profit / invested) * 100 : 0;
    return { invested, current, profit, roi };
  }, [data.investments]);

  const distribution = useMemo(() => {
    const map = {};
    for (const i of data.investments) map[i.category] = (map[i.category] || 0) + i.currentCents;
    return Object.entries(map).map(([cat, v]) => ({ name: cat, value: v / 100, color: INVEST_COLORS[cat] || "#888" }));
  }, [data.investments]);

  return (
    <div className="mf-anim-in">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Investido" valueCents={totals.invested} icon={Wallet} tone="neutral" />
        <StatCard label="Valor atual" valueCents={totals.current} icon={TrendingUp} tone="gold" />
        <StatCard label="Lucro/Prejuízo" valueCents={totals.profit} icon={totals.profit >= 0 ? ArrowUpCircle : ArrowDownCircle} tone={totals.profit >= 0 ? "income" : "expense"} sub={pct(totals.roi)} />
      </div>

      {data.investments.length > 0 && (
        <div className="mf-card" style={{ padding: 18, marginBottom: 18 }}>
          <SectionTitle title="Distribuição por categoria" />
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                  {distribution.map((c, i) => <Cell key={i} fill={c.color} stroke="var(--surface)" strokeWidth={2} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
                <RTooltip content={<ChartTooltip formatter={(p) => `${p.name}: ${brl(p.value * 100)} (${((p.value / (totals.current / 100)) * 100).toFixed(1)}%)`} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15} /> Novo investimento</button>
      </div>

      {data.investments.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Nenhum investimento cadastrado" description="Adicione seus investimentos para acompanhar patrimônio e rentabilidade." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={14} /> Novo investimento</button>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.investments.map((i) => {
            const profit = i.currentCents - i.investedCents;
            const roi = i.investedCents > 0 ? (profit / i.investedCents) * 100 : 0;
            return (
              <div key={i.id} className="mf-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <IconBadge icon="📈" color={INVEST_COLORS[i.category] || "#888"} />
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{i.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{i.category} · {i.institution || "—"} · {fmtDateBR(i.date)}</div>
                </div>
                <MiniStat label="Investido" value={brl(i.investedCents)} />
                <MiniStat label="Atual" value={brl(i.currentCents)} />
                <MiniStat label="Rentabilidade" value={pct(roi)} color={roi >= 0 ? "var(--income)" : "var(--expense)"} />
                <div style={{ display: "flex", gap: 4 }}>
                  <IconBtn onClick={() => openEditFix(i)}><Pencil size={13} /></IconBtn>
                  <IconBtn onClick={() => setConfirmId(i.id)} danger><Trash2 size={13} /></IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "Editar investimento" : "Novo investimento"} footer={<>
        <button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setModal(false)}>Cancelar</button>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button>
      </>}>
        <Field label="Nome"><input className="mf-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Tesouro Selic 2029" />{errors.name && <ErrorText>{errors.name}</ErrorText>}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Categoria">
            <select className="mf-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {INVEST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Instituição"><input className="mf-input" value={form.institution} onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Valor investido (R$)"><input className="mf-input" inputMode="decimal" value={form.invested} onChange={(e) => setForm((f) => ({ ...f, invested: e.target.value }))} />{errors.invested && <ErrorText>{errors.invested}</ErrorText>}</Field>
          <Field label="Valor atual (R$)"><input className="mf-input" inputMode="decimal" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />{errors.current && <ErrorText>{errors.current}</ErrorText>}</Field>
        </div>
        <Field label="Data"><input className="mf-input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
        <Field label="Observação (opcional)"><input className="mf-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
      </Modal>
      <ConfirmDialog open={!!confirmId} title="Excluir investimento" message={`Excluir "${data.investments.find((i) => i.id === confirmId)?.name || ""}"?`} onCancel={() => setConfirmId(null)} onConfirm={() => remove(confirmId)} />
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "right", minWidth: 84 }}>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{label}</div>
      <div className="mf-mono" style={{ fontWeight: 700, fontSize: 13.5, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}

/* =========================================================================
   METAS
   ========================================================================= */

function emptyGoal() { return { id: null, name: "", target: "", current: "", deadline: "", category: "", description: "" }; }

function Goals({ data, setData }) {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyGoal());
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [addValue, setAddValue] = useState("");

  const openNew = () => { setForm(emptyGoal()); setErrors({}); setModal(true); };
  const openEdit = (g) => { setForm({ ...g, target: (g.targetCents / 100).toFixed(2).replace(".", ","), current: (g.currentCents / 100).toFixed(2).replace(".", ",") }); setErrors({}); setModal(true); };

  const save = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nome obrigatório";
    if (toCents(form.target) <= 0) e.target = "Valor objetivo deve ser maior que zero";
    if (toCents(form.current) < 0) e.current = "Valor não pode ser negativo";
    setErrors(e);
    if (Object.keys(e).length) return;
    const targetCents = toCents(form.target);
    const currentCents = toCents(form.current || "0");
    if (form.id) {
      setData((d) => ({ ...d, goals: d.goals.map((g) => g.id === form.id ? { ...g, name: form.name.trim(), targetCents, currentCents, deadline: form.deadline, category: form.category, description: form.description } : g) }));
      toast("Meta atualizada.");
    } else {
      setData((d) => ({ ...d, goals: [...d.goals, { id: uid(), name: form.name.trim(), targetCents, currentCents, deadline: form.deadline, category: form.category, description: form.description }] }));
      toast("Meta criada.");
    }
    setModal(false);
  };
  const remove = (id) => { setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) })); toast("Meta removida."); setConfirmId(null); };

  const addAmount = () => {
    const cents = toCents(addValue);
    if (cents <= 0) return;
    setData((d) => ({ ...d, goals: d.goals.map((g) => g.id === addModal ? { ...g, currentCents: Math.max(0, g.currentCents + cents) } : g) }));
    toast("Valor adicionado à meta.");
    setAddModal(null); setAddValue("");
  };

  return (
    <div className="mf-anim-in">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15} /> Nova meta</button>
      </div>
      {data.goals.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma meta cadastrada" description="Defina metas financeiras e acompanhe seu progresso." action={<button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={14} /> Nova meta</button>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
          {data.goals.map((g) => {
            const progress = g.targetCents > 0 ? Math.min(100, (g.currentCents / g.targetCents) * 100) : 0;
            return (
              <div key={g.id} className="mf-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                    {g.deadline && <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>até {fmtDateBR(g.deadline)}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => openEdit(g)}><Pencil size={13} /></IconBtn>
                    <IconBtn onClick={() => setConfirmId(g.id)} danger><Trash2 size={13} /></IconBtn>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                  <Money cents={g.currentCents} size={17} weight={700} /> <span style={{ color: "var(--text-faint)", fontSize: 13 }}>/ {brl(g.targetCents)}</span>
                </div>
                <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--brand), var(--brand-2))", borderRadius: 5, transition: "width .3s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-2)" }}>{progress.toFixed(0)}%</span>
                  <button className="mf-btn mf-btn-ghost mf-focus" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => { setAddModal(g.id); setAddValue(""); }}>+ Adicionar valor</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "Editar meta" : "Nova meta"} footer={<>
        <button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setModal(false)}>Cancelar</button>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button>
      </>}>
        <Field label="Nome"><input className="mf-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Comprar carro" />{errors.name && <ErrorText>{errors.name}</ErrorText>}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Valor objetivo (R$)"><input className="mf-input" inputMode="decimal" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} />{errors.target && <ErrorText>{errors.target}</ErrorText>}</Field>
          <Field label="Valor atual (R$)"><input className="mf-input" inputMode="decimal" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />{errors.current && <ErrorText>{errors.current}</ErrorText>}</Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Prazo"><input className="mf-input" type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} /></Field>
          <Field label="Categoria"><input className="mf-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Ex: Compras" /></Field>
        </div>
        <Field label="Descrição (opcional)"><input className="mf-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      </Modal>

      <Modal open={!!addModal} onClose={() => setAddModal(null)} title="Adicionar valor à meta" footer={<>
        <button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setAddModal(null)}>Cancelar</button>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={addAmount}>Adicionar</button>
      </>}>
        <Field label="Valor (R$)"><input className="mf-input" inputMode="decimal" autoFocus value={addValue} onChange={(e) => setAddValue(e.target.value)} placeholder="0,00" /></Field>
      </Modal>
      <ConfirmDialog open={!!confirmId} title="Excluir meta" message={`Excluir a meta "${data.goals.find((g) => g.id === confirmId)?.name || ""}"?`} onCancel={() => setConfirmId(null)} onConfirm={() => remove(confirmId)} />
    </div>
  );
}

/* =========================================================================
   RELATÓRIOS
   ========================================================================= */

function Reports({ data }) {
  const fin = useFinance(data);
  const activeMonth = getActiveMonth(data);
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState(isoToday().slice(0, 8) + "01");
  const [customEnd, setCustomEnd] = useState(isoToday());

  const { start, end } = useMemo(() => {
    const today = isoToday();
    if (period === "today") return { start: today, end: today };
    if (period === "week") return { start: addMonthsISO(today, 0).slice(0, 10) > today ? today : shiftDays(today, -7), end: today };
    if (period === "month") return { start: activeMonth + "-01", end: monthEndISO(activeMonth) };
    if (period === "year") return { start: today.slice(0, 4) + "-01-01", end: today };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd, activeMonth]);

  const totals = fin.periodTotals(start, end);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of data.transactions) {
      if (t.type !== "expense" || t.status !== "paid" || t.transfer) continue;
      if (t.date < start || t.date > end) continue;
      map[t.categoryId] = (map[t.categoryId] || 0) + safeCents(t.valueCents);
    }
    for (const b of data.bills || []) {
      const d = b.paidDate || b.dueDate;
      if (b.status !== "paid" || d < start || d > end) continue;
      map[b.categoryId] = (map[b.categoryId] || 0) + safeCents(b.valueCents);
    }
    return Object.entries(map).map(([id, v]) => ({ name: fin.categoryName(id), value: v / 100 })).sort((a, b) => b.value - a.value);
  }, [data.transactions, start, end, fin]);

  const topExpenses = useMemo(() => {
    return data.transactions.filter((t) => t.type === "expense" && t.status === "paid" && !t.transfer && t.date >= start && t.date <= end)
      .sort((a, b) => b.valueCents - a.valueCents).slice(0, 8);
  }, [data.transactions, start, end]);

  const byCard = useMemo(() => {
    const map = {};
    for (const p of data.cardPurchases) {
      if (p.date < start || p.date > end) continue;
      map[p.cardId] = (map[p.cardId] || 0) + p.valueCents;
    }
    return data.cards.map((c) => ({ name: c.name, value: map[c.id] || 0 })).filter((x) => x.value > 0);
  }, [data.cardPurchases, data.cards, start, end]);

  const byAccount = useMemo(() => {
    const map = {};
    for (const t of data.transactions) {
      if (t.type !== "expense" || t.status !== "paid" || t.transfer) continue;
      if (t.date < start || t.date > end) continue;
      map[t.accountId] = (map[t.accountId] || 0) + safeCents(t.valueCents);
    }
    for (const b of data.bills || []) {
      const d = b.paidDate || b.dueDate;
      if (b.status !== "paid" || d < start || d > end) continue;
      const accountId = b.paymentAccountId || b.accountId;
      map[accountId] = (map[accountId] || 0) + safeCents(b.valueCents);
    }
    return data.accounts.map((a) => ({ name: a.name, value: map[a.id] || 0 })).filter((x) => x.value > 0);
  }, [data.transactions, data.accounts, start, end]);

  const evolution = useMemo(() => buildEvolution(data), [data]);

  const exportCSV = () => {
    const rows = data.transactions.filter((t) => t.status === "paid" && t.date >= start && t.date <= end)
      .sort((a, b) => a.date < b.date ? -1 : 1);
    const header = "Data,Tipo,Descrição,Categoria,Valor";
    const lines = rows.map((t) => {
      const cat = fin.categoryName(t.categoryId).replace(/,/g, " ");
      const desc = t.description.replace(/,/g, " ");
      const val = (t.valueCents / 100).toFixed(2).replace(".", ",");
      return `${fmtDateBR(t.date)},${t.type === "income" ? "Entrada" : "Saída"},${desc},${cat},${val}`;
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-meu-financeiro-${start}-a-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mf-anim-in">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center", justifyContent: "space-between" }}>
        <SegTabs value={period} onChange={setPeriod} options={[{ value: "today", label: "Hoje" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }, { value: "year", label: "Ano" }, { value: "custom", label: "Personalizado" }]} />
        <button className="mf-btn mf-btn-ghost mf-focus" onClick={exportCSV}><Download size={14} /> Exportar CSV</button>
      </div>
      {period === "custom" && (
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <Field label="Data inicial"><input className="mf-input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></Field>
          <Field label="Data final"><input className="mf-input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></Field>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Entradas" valueCents={totals.income} icon={ArrowUpCircle} tone="income" />
        <StatCard label="Saídas" valueCents={totals.expense} icon={ArrowDownCircle} tone="expense" />
        <StatCard label="Economia" valueCents={totals.savings} icon={TrendingUp} tone={totals.savings >= 0 ? "income" : "expense"} />
      </div>

      <div className="mf-card" style={{ padding: 18, marginBottom: 14 }}>
        <SectionTitle title="Evolução da economia" subtitle="Últimos 6 meses (valores negativos aparecem abaixo de zero)" />
        <div style={{ width: "100%", height: 230 }}>
          <ResponsiveContainer>
            <LineChart data={evolution} margin={{ left: -18, right: 10, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--text-faint)" fontSize={12} />
              <YAxis stroke="var(--text-faint)" fontSize={11} tickFormatter={(v) => (v / 100).toLocaleString("pt-BR")} />
              <RTooltip content={<ChartTooltip formatter={(p) => `${p.name}: ${brl(p.value)}`} />} />
              <Line type="monotone" dataKey="savings" name="Economia" stroke="var(--brand-2)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }} className="mf-grid-2">
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Gastos por categoria" />
          {byCategory.length === 0 ? <EmptyState icon={Tags} title="Sem dados" description="Nenhum gasto no período selecionado." /> : (
            <div style={{ width: "100%", height: Math.max(180, byCategory.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={byCategory} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-faint)" fontSize={11} tickFormatter={(v) => (v).toLocaleString("pt-BR")} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-faint)" fontSize={12} width={100} />
                  <RTooltip content={<ChartTooltip formatter={(p) => `${brl(p.value * 100)}`} />} />
                  <Bar dataKey="value" fill="var(--brand-2)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Maiores despesas" />
          {topExpenses.length === 0 ? <EmptyState icon={ArrowDownCircle} title="Sem despesas" description="Nenhuma despesa no período." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topExpenses.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{t.description}</span>
                  <Money cents={t.valueCents} weight={700} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="mf-grid-2">
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Gastos por cartão" />
          {byCard.length === 0 ? <EmptyState icon={CreditCard} title="Sem dados" description="Nenhuma compra no cartão no período." /> : byCard.map((c) => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5, borderTop: "1px solid var(--border)" }}>
              <span>{c.name}</span><Money cents={c.value} weight={700} />
            </div>
          ))}
        </div>
        <div className="mf-card" style={{ padding: 18 }}>
          <SectionTitle title="Gastos por conta" />
          {byAccount.length === 0 ? <EmptyState icon={Landmark} title="Sem dados" description="Nenhuma saída registrada no período." /> : byAccount.map((a) => (
            <div key={a.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5, borderTop: "1px solid var(--border)" }}>
              <span>{a.name}</span><Money cents={a.value} weight={700} />
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 760px) { .mf-grid-2 { grid-template-columns: 1fr !important; } .mf-card { max-width: 100%; } }`}</style>
    </div>
  );
}

function shiftDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* =========================================================================
   CALCULADORA
   ========================================================================= */

function CalculatorSection() {
  const [mode, setMode] = useState("comum");
  const modes = [
    { value: "comum", label: "Comum" },
    { value: "porcentagem", label: "Porcentagem" },
    { value: "juros-simples", label: "Juros simples" },
    { value: "juros-compostos", label: "Juros compostos" },
    { value: "parcelamento", label: "Parcelamento" },
    { value: "financiamento", label: "Financiamento" },
    { value: "desconto", label: "Desconto / Aumento" },
    { value: "regra-tres", label: "Regra de três" },
  ];
  return (
    <div className="mf-anim-in">
      <div style={{ marginBottom: 18, overflowX: "auto" }}>
        <SegTabs value={mode} onChange={setMode} options={modes} />
      </div>
      <div style={{ maxWidth: 480 }}>
        {mode === "comum" && <CommonCalc />}
        {mode === "porcentagem" && <PercentCalc />}
        {mode === "juros-simples" && <SimpleInterestCalc />}
        {mode === "juros-compostos" && <CompoundInterestCalc />}
        {mode === "parcelamento" && <InstallmentCalc />}
        {mode === "financiamento" && <FinancingCalc />}
        {mode === "desconto" && <DiscountCalc />}
        {mode === "regra-tres" && <RuleOfThreeCalc />}
      </div>
    </div>
  );
}

function ResultBox({ children }) {
  return <div className="mf-card" style={{ padding: 16, marginTop: 16, background: "var(--surface-2)" }}>{children}</div>;
}
function ResultLine({ label, value, big }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</span>
      <span className="mf-mono" style={{ fontWeight: 700, fontSize: big ? 19 : 14.5 }}>{value}</span>
    </div>
  );
}

function CommonCalc() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const press = (v) => setExpr((e) => e + v);
  const clear = () => { setExpr(""); setResult(null); setError(""); };
  const back = () => setExpr((e) => e.slice(0, -1));
  const equals = () => {
    try { const r = safeEvaluate(expr); setResult(r); setError(""); }
    catch (e) { setError(e.message); setResult(null); }
  };
  const btns = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "+"];
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <div className="mf-mono" style={{ background: "var(--surface-2)", borderRadius: 10, padding: "16px 14px", fontSize: 22, minHeight: 60, wordBreak: "break-all", border: "1px solid var(--border)" }}>
        {expr || <span style={{ color: "var(--text-faint)" }}>0</span>}
      </div>
      {result !== null && <div className="mf-mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--brand-2)", textAlign: "right", marginTop: 8 }}>= {result.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</div>}
      {error && <ErrorText>{error}</ErrorText>}
      <div className="mf-calc-grid">
        <CalcBtn onClick={clear}>C</CalcBtn>
        <CalcBtn onClick={back}><Delete size={16} /></CalcBtn>
        <CalcBtn onClick={() => press("(")}>(</CalcBtn>
        <CalcBtn onClick={() => press(")")}>)</CalcBtn>
        {btns.map((b) => <CalcBtn key={b} onClick={() => press(b)} op={"+-*/".includes(b)}>{b === "*" ? "×" : b === "/" ? <Divide size={15} /> : b}</CalcBtn>)}
        <CalcBtn onClick={equals} primary wide2>=</CalcBtn>
      </div>
    </div>
  );
}
function CalcBtn({ children, onClick, wide, wide2, op, primary }) {
  return (
    <button className="mf-focus" onClick={onClick} style={{
      gridColumn: wide ? "span 1" : wide2 ? "span 4" : "span 1",
      padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontSize: 17, fontWeight: 600,
      width: "100%", minWidth: 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      background: primary ? "var(--brand)" : op ? "var(--surface-2)" : "var(--surface)", color: primary ? "white" : op ? "var(--brand-2)" : "var(--text)"
    }}>{children}</button>
  );
}

function PercentCalc() {
  const [value, setValue] = useState(""); const [percent, setPercent] = useState("");
  const v = parseFloat(value.replace(",", ".")) || 0; const p = parseFloat(percent.replace(",", ".")) || 0;
  const result = (v * p) / 100;
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <Field label="Valor (R$)"><input className="mf-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="1000" /></Field>
      <Field label="Porcentagem (%)"><input className="mf-input" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="15" /></Field>
      <ResultBox><ResultLine label={`${percent || 0}% de ${brl(toCents(value))}`} value={brl(Math.round(result * 100))} big /></ResultBox>
    </div>
  );
}

function SimpleInterestCalc() {
  const [capital, setCapital] = useState(""); const [rate, setRate] = useState(""); const [time, setTime] = useState("");
  const P = parseFloat(capital.replace(",", ".")) || 0; const i = (parseFloat(rate.replace(",", ".")) || 0) / 100; const t = parseFloat(time.replace(",", ".")) || 0;
  const J = P * i * t; const M = P + J;
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <Field label="Capital inicial (R$)"><input className="mf-input" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} /></Field>
      <Field label="Taxa de juros (% ao mês)"><input className="mf-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      <Field label="Período (meses)"><input className="mf-input" inputMode="decimal" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      <ResultBox><ResultLine label="Juros" value={brl(Math.round(J * 100))} /><ResultLine label="Montante final" value={brl(Math.round(M * 100))} big /></ResultBox>
    </div>
  );
}

function CompoundInterestCalc() {
  const [capital, setCapital] = useState(""); const [rate, setRate] = useState(""); const [time, setTime] = useState(""); const [contribution, setContribution] = useState("");
  const P = parseFloat(capital.replace(",", ".")) || 0; const i = (parseFloat(rate.replace(",", ".")) || 0) / 100; const t = parseFloat(time.replace(",", ".")) || 0; const a = parseFloat(contribution.replace(",", ".")) || 0;
  let M = P * Math.pow(1 + i, t);
  if (a > 0 && i > 0) M += a * ((Math.pow(1 + i, t) - 1) / i);
  else if (a > 0) M += a * t;
  const totalInvested = P + a * t;
  const gain = M - totalInvested;
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <Field label="Capital inicial (R$)"><input className="mf-input" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} /></Field>
      <Field label="Taxa de juros (% ao mês)"><input className="mf-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      <Field label="Período (meses)"><input className="mf-input" inputMode="decimal" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      <Field label="Aporte mensal (opcional)"><input className="mf-input" inputMode="decimal" value={contribution} onChange={(e) => setContribution(e.target.value)} /></Field>
      <ResultBox>
        <ResultLine label="Total investido" value={brl(Math.round(totalInvested * 100))} />
        <ResultLine label="Juros ganhos" value={brl(Math.round(gain * 100))} />
        <ResultLine label="Montante final" value={brl(Math.round(M * 100))} big />
      </ResultBox>
    </div>
  );
}

function InstallmentCalc() {
  const [total, setTotal] = useState(""); const [n, setN] = useState(""); const [rate, setRate] = useState("");
  const V = parseFloat(total.replace(",", ".")) || 0; const parcels = parseInt(n) || 0; const i = (parseFloat(rate.replace(",", ".")) || 0) / 100;
  let parcelValue = 0, totalPaid = 0;
  if (parcels > 0) {
    if (i > 0) {
      parcelValue = (V * i * Math.pow(1 + i, parcels)) / (Math.pow(1 + i, parcels) - 1);
    } else {
      parcelValue = V / parcels;
    }
    totalPaid = parcelValue * parcels;
  }
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <Field label="Valor total (R$)"><input className="mf-input" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
      <Field label="Número de parcelas"><input className="mf-input" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></Field>
      <Field label="Juros ao mês (opcional, %)"><input className="mf-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      <ResultBox>
        <ResultLine label="Parcelas" value={parcels || "—"} />
        <ResultLine label="Valor de cada parcela" value={brl(Math.round(parcelValue * 100))} big />
        <ResultLine label="Total pago" value={brl(Math.round(totalPaid * 100))} />
      </ResultBox>
    </div>
  );
}

function FinancingCalc() {
  const [value, setValue] = useState(""); const [rate, setRate] = useState(""); const [months, setMonths] = useState("");
  const V = parseFloat(value.replace(",", ".")) || 0; const i = (parseFloat(rate.replace(",", ".")) || 0) / 100; const n = parseInt(months) || 0;
  let installment = 0, total = 0, interest = 0;
  if (n > 0 && i > 0) {
    installment = (V * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    total = installment * n;
    interest = total - V;
  } else if (n > 0) {
    installment = V / n; total = V; interest = 0;
  }
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <Field label="Valor financiado (R$)"><input className="mf-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      <Field label="Taxa de juros ao mês (%)"><input className="mf-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      <Field label="Número de meses"><input className="mf-input" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></Field>
      <ResultBox>
        <ResultLine label="Parcela mensal (Tabela Price)" value={brl(Math.round(installment * 100))} big />
        <ResultLine label="Total pago" value={brl(Math.round(total * 100))} />
        <ResultLine label="Total de juros" value={brl(Math.round(interest * 100))} />
      </ResultBox>
    </div>
  );
}

function DiscountCalc() {
  const [value, setValue] = useState(""); const [percent, setPercent] = useState("");
  const V = parseFloat(value.replace(",", ".")) || 0; const p = parseFloat(percent.replace(",", ".")) || 0;
  const discounted = V * (1 - p / 100); const increased = V * (1 + p / 100);
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <Field label="Valor original (R$)"><input className="mf-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      <Field label="Porcentagem (%)"><input className="mf-input" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>
      <ResultBox>
        <ResultLine label="Valor com desconto" value={brl(Math.round(discounted * 100))} />
        <ResultLine label="Valor com aumento" value={brl(Math.round(increased * 100))} />
      </ResultBox>
    </div>
  );
}

function RuleOfThreeCalc() {
  const [A, setA] = useState(""); const [B, setB] = useState(""); const [C, setC] = useState("");
  const a = parseFloat(A.replace(",", ".")) || 0; const b = parseFloat(B.replace(",", ".")) || 0; const c = parseFloat(C.replace(",", ".")) || 0;
  const valid = a !== 0;
  const x = valid ? (b * c) / a : 0;
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 0 }}>A está para B, assim como C está para X</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="A"><input className="mf-input" inputMode="decimal" value={A} onChange={(e) => setA(e.target.value)} /></Field>
        <Field label="B"><input className="mf-input" inputMode="decimal" value={B} onChange={(e) => setB(e.target.value)} /></Field>
        <Field label="C"><input className="mf-input" inputMode="decimal" value={C} onChange={(e) => setC(e.target.value)} /></Field>
      </div>
      {!valid && A !== "" && <ErrorText>A não pode ser zero.</ErrorText>}
      <ResultBox><ResultLine label="X" value={valid ? x.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "—"} big /></ResultBox>
    </div>
  );
}

/* =========================================================================
   CATEGORIAS
   ========================================================================= */

const CATEGORY_COLORS = ["#5B8CDB", "#E0A63A", "#7C8CF8", "#C96FE0", "#E0615B", "#4FAFA0", "#D98CC2", "#2FAE7C", "#C9A227", "#3EA6D9", "#8C97AD", "#DC5B4B"];
const CATEGORY_ICONS = ["🏠", "🍽️", "🚗", "🎮", "🩺", "📚", "🛍️", "🔁", "💰", "📈", "✈️", "🐾", "🎓", "🎁", "💼", "🔀", "💳", "🛠️", "📱", "🎬"];

function emptyCategory() { return { id: null, name: "", icon: CATEGORY_ICONS[0], color: CATEGORY_COLORS[0] }; }

function Categories({ data, setData }) {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyCategory());
  const [errors, setErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);

  const openNew = () => { setForm(emptyCategory()); setErrors({}); setModal(true); };
  const openEdit = (c) => { setForm(c); setErrors({}); setModal(true); };

  const save = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nome obrigatório";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (form.id) {
      setData((d) => ({ ...d, categories: d.categories.map((c) => c.id === form.id ? { ...c, name: form.name.trim(), icon: form.icon, color: form.color } : c) }));
      toast("Categoria atualizada.");
    } else {
      setData((d) => ({ ...d, categories: [...d.categories, { id: uid(), name: form.name.trim(), icon: form.icon, color: form.color }] }));
      toast("Categoria adicionada.");
    }
    setModal(false);
  };
  const remove = (id) => { setData((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) })); toast("Categoria removida."); setConfirmId(null); };

  return (
    <div className="mf-anim-in">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={openNew}><Plus size={15} /> Nova categoria</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 12 }}>
        {data.categories.map((c) => (
          <div key={c.id} className="mf-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <IconBadge icon={c.icon} color={c.color} />
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <IconBtn onClick={() => openEdit(c)}><Pencil size={12} /></IconBtn>
              <IconBtn onClick={() => setConfirmId(c.id)} danger><Trash2 size={12} /></IconBtn>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "Editar categoria" : "Nova categoria"} footer={<>
        <button className="mf-btn mf-btn-ghost mf-focus" onClick={() => setModal(false)}>Cancelar</button>
        <button className="mf-btn mf-btn-primary mf-focus" onClick={save}>Salvar</button>
      </>}>
        <Field label="Nome"><input className="mf-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />{errors.name && <ErrorText>{errors.name}</ErrorText>}</Field>
        <Field label="Ícone">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORY_ICONS.map((ic) => (
              <button key={ic} className="mf-focus" onClick={() => setForm((f) => ({ ...f, icon: ic }))} style={{
                width: 36, height: 36, borderRadius: 9, fontSize: 17, cursor: "pointer",
                background: form.icon === ic ? "var(--brand)" : "var(--surface-2)", border: "1px solid var(--border)"
              }}>{ic}</button>
            ))}
          </div>
        </Field>
        <Field label="Cor">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATEGORY_COLORS.map((c) => <button key={c} className="mf-focus" onClick={() => setForm((f) => ({ ...f, color: c }))} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: form.color === c ? "3px solid var(--text)" : "2px solid transparent", cursor: "pointer" }} />)}
          </div>
        </Field>
      </Modal>
      <ConfirmDialog open={!!confirmId} title="Excluir categoria" message="Excluir esta categoria? Transações associadas ficarão sem categoria." onCancel={() => setConfirmId(null)} onConfirm={() => remove(confirmId)} />
    </div>
  );
}

/* =========================================================================
   CONFIGURAÇÕES
   ========================================================================= */

function emptyData(theme = "dark") {
  return {
    categories: DEFAULT_CATEGORIES,
    accounts: [],
    cards: [],
    transactions: [],
    bills: [],
    cardPurchases: [],
    invoicePayments: {},
    recurringReceipts: [],
    investments: [],
    goals: [],
    settings: { theme, activeMonth: isoToday().slice(0, 7), closedMonths: [] },
  };
}

function SettingsSection({ data, setData }) {
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "meu-financeiro-backup.json"; a.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado.");
  };

  const resetData = () => {
    // Reiniciar significa realmente zerar os dados da conta, sem recriar
    // lançamentos, contas, cartões, investimentos ou metas de exemplo.
    setData(emptyData(data.settings?.theme || "dark"));
    toast("Dados zerados.");
    setConfirmReset(false);
  };

  return (
    <div className="mf-anim-in" style={{ maxWidth: 560 }}>
      <div className="mf-card" style={{ padding: 18, marginBottom: 14 }}>
        <SectionTitle title="Aparência" subtitle="O tema escolhido fica salvo automaticamente." />
        <ThemeToggle theme={data.settings.theme} onToggle={() => setData((d) => ({ ...d, settings: { ...d.settings, theme: d.settings.theme === "dark" ? "light" : "dark" } }))} />
      </div>

      <div className="mf-card" style={{ padding: 18, marginBottom: 14 }}>
        <SectionTitle title="Dados" subtitle="Seus dados ficam salvos automaticamente nesta conta." />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="mf-btn mf-btn-ghost mf-focus" onClick={exportJSON}><Download size={14} /> Exportar backup (JSON)</button>
          <button className="mf-btn mf-btn-danger mf-focus" onClick={() => setConfirmReset(true)}><Trash2 size={14} /> Reiniciar dados</button>
        </div>
      </div>

      <div className="mf-card" style={{ padding: 18 }}>
        <SectionTitle title="Resumo" />
        <ResultLine label="Contas cadastradas" value={data.accounts.length} />
        <ResultLine label="Cartões cadastrados" value={data.cards.length} />
        <ResultLine label="Transações" value={data.transactions.length} />
        <ResultLine label="Categorias" value={data.categories.length} />
        <ResultLine label="Investimentos" value={data.investments.length} />
        <ResultLine label="Metas" value={data.goals.length} />
      </div>

      <ConfirmDialog open={confirmReset} title="Reiniciar todos os dados" message="Isso vai apagar todos os seus dados financeiros desta conta. Contas, cartões, transações, contas a pagar, compras, investimentos e metas ficarão zerados. Essa ação não pode ser desfeita." onCancel={() => setConfirmReset(false)} onConfirm={resetData} />
    </div>
  );
}