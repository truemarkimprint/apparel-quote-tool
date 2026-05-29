import React, { useMemo, useState, useEffect } from "react";
import jsPDF from "jspdf";
import logo from "./assets/TrueMark Single logo.png";
import autoTable from "jspdf-autotable";
import { Calculator, Shirt, RefreshCcw, Package, FileText, List, X, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zbnpewjafbztidohytjh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpibnBld2phZmJ6dGlkb2h5dGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODU5ODQsImV4cCI6MjA5NTE2MTk4NH0.iblJDKPf5oS1M695FmjRDaG3AQES0l_QM-3eiBoBlbg"
);

const ORDER_STAGES = [
  "Order Created",
  "In Production",
  "Quality Check",
  "Ready",
  "Pickup / Shipped / Delivered",
  "Completed",
];

const garmentCatalog = {
  tees: [
    { id: "g500", label: "Budget Tee — Gildan G500 (Standard Cotton)", baseCost: 5.25, premium: false },
    { id: "g3933", label: "Tank Top — NxtLvl 3933 (Standard Cotton)", baseCost: 4.62, premium: false },
    { id: "pc54", label: "Value Tee — Port & Company PC54 (Softer Cotton)", baseCost: 5.95, premium: false },
    { id: "n3600", label: "Soft Tee — Next Level 3600 (Retail Fit)", baseCost: 7.75, premium: true },
    { id: "3001", label: "Premium Tee — Bella+Canvas 3001 (Best Seller)", baseCost: 8.5, premium: true },
    { id: "dm130", label: "Triblend Tee — District DM130 (Ultra Soft)", baseCost: 3.99, premium: true },
    { id: "g2400", label: "LS Tee — Gildan G2400 (Ultra Cotton)", baseCost: 6.56, premium: true },
    { id: "g5400", label: "LS Tee — Gildan G5400 (Heavy Cotton)", baseCost: 5.93, premium: false },
    { id: "c1717", label: "Heavyweight Tee — Comfort Colors 1717 (Garment Dyed)", baseCost: 9.5, premium: true },
  ],
  bottoms: [
    { id: "lst311", label: "Shorts — Sport-Tek LST311 Womens Jersey Knit Squad Short", baseCost: 6.33, premium: false },
  ],
  hoodies: [
    { id: "g185", label: "Budget Hoodie — Gildan G185", baseCost: 17.5, premium: false },
    { id: "pc78h", label: "Core Hoodie — Port & Company PC78H", baseCost: 19.25, premium: false },
    { id: "3719", label: "Premium Hoodie — Bella+Canvas 3719", baseCost: 28.75, premium: true },
  ],
  polos: [
    { id: "k100", label: "Core Polo — Port Authority K100", baseCost: 15.95, premium: false },
    { id: "st640", label: "Performance Polo — Sport-Tek ST640", baseCost: 18.85, premium: false },
    { id: "nkdc1963", label: "Premium Polo — Nike Dri-FIT Micro Pique", baseCost: 34.5, premium: true },
  ],
  hats: [
    { id: "cp80", label: "Budget Cap — Port & Company CP80", baseCost: 6.25, premium: false },
    { id: "112", label: "Premium Trucker — Richardson 112", baseCost: 8.9, premium: true },
    { id: "169", label: "Premium 7PanelFlat — Richardson 169", baseCost: 12.0, premium: true },
    { id: "c112", label: "Premium Snapback — Yupoong Classics", baseCost: 9.6, premium: true },
  ],
};

const defaultTiers = [
  { minQty: 1, maxQty: 11, garmentCostAdj: 0 },
  { minQty: 12, maxQty: 23, garmentCostAdj: -0.15 },
  { minQty: 24, maxQty: 47, garmentCostAdj: -0.35 },
  { minQty: 48, maxQty: 99, garmentCostAdj: -0.65 },
  { minQty: 100, maxQty: 249, garmentCostAdj: -0.85 },
  { minQty: 250, maxQty: 9999, garmentCostAdj: -1.1 },
];

const cardStyle = {
  background: "white", borderRadius: 20, padding: 24,
  boxShadow: "0 8px 30px rgba(15,23,42,0.08)", border: "1px solid #e2e8f0",
};
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 12,
  border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box",
};
const readOnlyStyle = {
  ...inputStyle, background: "#f1f5f9", color: "#0f172a",
  display: "flex", alignItems: "center", minHeight: 42,
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 };
const buttonStyle = {
  padding: "10px 14px", borderRadius: 12, border: "1px solid #cbd5e1",
  background: "white", color: "#0f172a", cursor: "pointer", fontWeight: 600,
};

function currency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}
function safeNum(value) {
  const p = parseFloat(value); return Number.isFinite(p) ? p : 0;
}
function round2(n) { return Math.round(n * 100) / 100; }
function slugify(value) {
  return (value || "quote").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function getTierForQty(qty, tiers) {
  return tiers.find((t) => qty >= safeNum(t.minQty) && qty <= safeNum(t.maxQty));
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <Icon size={20} /><h2 style={{ margin: 0, fontSize: 22 }}>{children}</h2>
    </div>
  );
}
function Field({ label, children }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}
function SummaryRow({ label, value, bold = false }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14,
      borderTop: bold ? "1px solid #e2e8f0" : "none", marginTop: bold ? 8 : 0,
      fontWeight: bold ? 700 : 500,
    }}>
      <span style={{ color: bold ? "#0f172a" : "#475569" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    draft:    { color: "#64748b", bg: "#f1f5f9", icon: Clock,       label: "Draft" },
    sent:     { color: "#d97706", bg: "#fef3c7", icon: Clock,       label: "Sent" },
    approved: { color: "#16a34a", bg: "#dcfce7", icon: CheckCircle, label: "Approved" },
    declined: { color: "#dc2626", bg: "#fee2e2", icon: XCircle,     label: "Declined" },
  }[status] || { color: "#64748b", bg: "#f1f5f9", icon: Clock, label: status };
  const Icon = config.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
      color: config.color, background: config.bg,
    }}>
      <Icon size={12} /> {config.label}
    </span>
  );
}

function StageBadge({ stage }) {
  const stageColors = {
    "Order Created":                { color: "#0369a1", bg: "#e0f2fe" },
    "In Production":                { color: "#7c3aed", bg: "#ede9fe" },
    "Quality Check":                { color: "#d97706", bg: "#fef3c7" },
    "Ready":                        { color: "#16a34a", bg: "#dcfce7" },
    "Pickup / Shipped / Delivered": { color: "#0f172a", bg: "#f1f5f9" },
    "Completed":                    { color: "#16a34a", bg: "#dcfce7" },
    "Cancelled":                    { color: "#dc2626", bg: "#fee2e2" },
  };
  const c = stageColors[stage] || { color: "#64748b", bg: "#f1f5f9" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
      color: c.color, background: c.bg,
    }}>
      {stage}
    </span>
  );
}

// ── Orders Drawer ────────────────────────────────────────────────────────────
function OrdersDrawer({ open, onClose, onViewQuote }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { if (open) fetchOrders(); }, [open]);

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders").select("*").order("created_at", { ascending: false });
    if (!error) setOrders(data || []);
    setLoading(false);
  }

  async function updateStage(id, stage) {
    await supabase.from("orders").update({
      stage, stage_updated_at: new Date().toISOString(),
    }).eq("id", id);
    fetchOrders();
  }

  async function deleteOrder(id) {
    if (!window.confirm("Delete this order? This can't be undone.")) return;
    await supabase.from("orders").delete().eq("id", id);
    if (expandedId === id) setExpandedId(null);
    fetchOrders();
  }

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        style={{
          position: "relative", width: 580, maxWidth: "95vw",
          background: "white", height: "100%", overflowY: "auto",
          padding: 28, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Active Orders</h2>
          <button onClick={onClose} style={{ ...buttonStyle, padding: "6px 10px" }}><X size={18} /></button>
        </div>

        {loading && <p style={{ color: "#64748b" }}>Loading orders…</p>}
        {!loading && orders.length === 0 && (
          <p style={{ color: "#64748b" }}>No orders yet. Mark a quote as Approved to create an order.</p>
        )}

        {orders.map((o) => {
          const isOpen = expandedId === o.id;
          const currentStageIdx = ORDER_STAGES.indexOf(o.stage);
          return (
            <div key={o.id} style={{
              border: "1px solid #e2e8f0", borderRadius: 16,
              marginBottom: 12, background: "#fafafa", overflow: "hidden",
            }}>
              {/* Collapsed header */}
              <div
                onClick={() => setExpandedId(isOpen ? null : o.id)}
                style={{
                  padding: "14px 18px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: isOpen ? "#f1f5f9" : "#fafafa",
                  borderBottom: isOpen ? "1px solid #e2e8f0" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", fontFamily: "monospace" }}>
                      {o.order_number}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{o.quote_name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {o.customer_name || "No customer"} · Qty: {o.total_qty} · {currency(o.final_total)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12 }}>
                  <StageBadge stage={o.stage} />
                  {isOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </div>
              </div>

              {/* Expanded */}
              {isOpen && (
                <div style={{ padding: 18 }}>
                  {/* Order summary */}
                  <div style={{ background: "#0f172a", color: "white", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>ORDER</div>
                      <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "monospace" }}>{o.order_number}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>PRICE / PC</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{currency(o.price_per_piece)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>TOTAL</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{currency(o.final_total)}</div>
                    </div>
                  </div>

                  {/* Order details */}
                  <div style={{ background: "white", borderRadius: 12, padding: "8px 12px", border: "1px solid #e2e8f0", marginBottom: 14, fontSize: 13 }}>
                    {[
                      ["Customer", o.customer_name || "—"],
                      ["Garment", o.garment_label || "—"],
                      ["Quantity", o.total_qty],
                      ["Sales Rep", o.sales_rep],
                      ["Created", new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
                      ["Stage Updated", new Date(o.stage_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ color: "#475569" }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stage progress */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Production Stage</div>
                      <button
                        onClick={() => updateStage(o.id, "Cancelled")}
                        style={{
                          ...buttonStyle, padding: "4px 12px", fontSize: 12,
                          color: "#dc2626", borderColor: "#fca5a5",
                          background: o.stage === "Cancelled" ? "#fee2e2" : "white",
                        }}
                      >
                        Cancel Order
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {ORDER_STAGES.map((stage, idx) => (
                        <button
                          key={stage}
                          onClick={() => updateStage(o.id, stage)}
                          style={{
                            ...buttonStyle,
                            padding: "8px 14px", fontSize: 13, textAlign: "left",
                            background: o.stage === stage ? "#0f172a" : idx < currentStageIdx ? "#f8fafc" : "white",
                            color: o.stage === stage ? "white" : idx < currentStageIdx ? "#94a3b8" : "#0f172a",
                            borderColor: o.stage === stage ? "#0f172a" : "#e2e8f0",
                            display: "flex", alignItems: "center", gap: 8,
                          }}
                        >
                          <span style={{
                            width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: o.stage === stage ? "white" : idx < currentStageIdx ? "#cbd5e1" : "#e2e8f0",
                            color: o.stage === stage ? "#0f172a" : "#64748b",
                            flexShrink: 0,
                          }}>
                            {idx < currentStageIdx ? "✓" : idx + 1}
                          </span>
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link back to quote */}
                  <button
                    onClick={() => { onViewQuote(o.quote_id); onClose(); }}
                    style={{ ...buttonStyle, width: "100%", marginBottom: 10, fontSize: 13, textAlign: "center" }}
                  >
                    View Original Quote
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteOrder(o.id)}
                    style={{ ...buttonStyle, width: "100%", fontSize: 13, color: "#dc2626", borderColor: "#fca5a5" }}
                  >
                    Delete Order
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Saved Quotes Drawer ──────────────────────────────────────────────────────
function SavedQuotesDrawer({ open, onClose, highlightId }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { if (open) fetchQuotes(); }, [open]);
  useEffect(() => { if (highlightId) setExpandedId(highlightId); }, [highlightId]);

  async function fetchQuotes() {
    setLoading(true);
    const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
    if (!error) setQuotes(data || []);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    if (status === "approved") {
      const quote = quotes.find((q) => q.id === id);
      if (quote) await createOrder(quote);
    }
    await supabase.from("quotes").update({ status }).eq("id", id);
    fetchQuotes();
  }

 async function createOrder(quote) {
    const { data: seqData } = await supabase.rpc("next_order_number");
    const orderNumber = seqData || "TM-000";
    await supabase.from("orders").insert([{
      order_number: orderNumber,
      quote_id: quote.id,
      quote_name: quote.quote_name,
      customer_name: quote.customer_name,
      sales_rep: quote.sales_rep,
      garment_label: quote.garment_label,
      total_qty: quote.total_qty,
      price_per_piece: quote.price_per_piece,
      final_total: quote.final_total,
      stage: "Order Created",
      notes: quote.notes,
    }]);
  }

  async function deleteQuote(id) {
    if (!window.confirm("Delete this quote? This can't be undone.")) return;
    await supabase.from("quotes").delete().eq("id", id);
    if (expandedId === id) setExpandedId(null);
    fetchQuotes();
  }

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        style={{
          position: "relative", width: 560, maxWidth: "95vw",
          background: "white", height: "100%", overflowY: "auto",
          padding: 28, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Saved Quotes</h2>
          <button onClick={onClose} style={{ ...buttonStyle, padding: "6px 10px" }}><X size={18} /></button>
        </div>

        {loading && <p style={{ color: "#64748b" }}>Loading quotes…</p>}
        {!loading && quotes.length === 0 && (
          <p style={{ color: "#64748b" }}>No saved quotes yet. Generate a quote PDF to save your first one!</p>
        )}

        {quotes.map((q) => {
          const isOpen = expandedId === q.id;
          return (
            <div key={q.id} style={{
              border: isOpen && highlightId === q.id ? "2px solid #0f172a" : "1px solid #e2e8f0",
              borderRadius: 16, marginBottom: 12, background: "#fafafa", overflow: "hidden",
            }}>
              <div
                onClick={() => setExpandedId(isOpen ? null : q.id)}
                style={{
                  padding: "14px 18px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: isOpen ? "#f1f5f9" : "#fafafa",
                  borderBottom: isOpen ? "1px solid #e2e8f0" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{q.quote_name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {q.customer_name || "No customer"} · {new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Qty: {q.total_qty} · {currency(q.price_per_piece)}/pc
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12 }}>
                  <StatusBadge status={q.status} />
                  {isOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: 18 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#475569" }}>
                    <span style={{ fontWeight: 600, color: "#0f172a", marginRight: 8 }}>Sizes:</span>
                    {[
                      ["XS", q.qty_xs], ["S", q.qty_s], ["M", q.qty_m],
                      ["L", q.qty_l], ["XL", q.qty_xl], ["2XL", q.qty_2xl],
                      ["3XL", q.qty_3xl], ["4XL", q.qty_4xl],
                    ].filter(([, v]) => safeNum(v) > 0).map(([l, v]) => `${l}: ${v}`).join(" · ")}
                    <span style={{ marginLeft: 8, fontWeight: 600, color: "#0f172a" }}>(Total: {q.total_qty})</span>
                  </div>

                  <div style={{ background: "#0f172a", color: "white", borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>PRICE / PC</div>
                      <div style={{ fontWeight: 800, fontSize: 22 }}>{currency(q.price_per_piece)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>TOTAL</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{currency(q.final_total)}</div>
                    </div>
                  </div>

                  <div style={{ background: "white", borderRadius: 12, padding: "8px 12px", border: "1px solid #e2e8f0", marginBottom: 12 }}>
                    {[
                      ["Garment", q.garment_label || q.garment_type],
                      ["Quoted Quantity", q.total_qty],
                      ["Garment / ea", currency(q.garment_cost_each)],
                      ["DTF / ea", currency(q.decoration_cost_each)],
                      ["Garment Subtotal", currency(q.garment_subtotal)],
                      ["DTF Subtotal", currency(q.decoration_subtotal)],
                      ["Size Upcharges", currency(q.size_upcharge_total)],
                      ["Packaging Subtotal", currency(q.packaging_subtotal)],
                      ["Fixed Fees", currency(q.fixed_fees)],
                      ["Hard Cost", currency(q.hard_cost)],
                      ["Overhead (" + q.overhead_pct + "%)", currency(q.overhead)],
                      ["Profit (" + q.profit_margin_pct + "%)", currency(q.profit)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ color: "#475569" }}>{label}</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, fontWeight: 700 }}>
                      <span>Subtotal</span><span>{currency(q.subtotal)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", paddingTop: 4 }}>
                      Tax: {q.include_tax ? `${q.sales_tax_pct}%` : "none"}
                      {q.include_cc_fee ? ` · CC Fee: ${q.cc_fee_pct}%` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["draft", "sent", "approved", "declined"].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(q.id, s)}
                          style={{
                            ...buttonStyle, padding: "5px 12px", fontSize: 12,
                            background: q.status === s ? "#0f172a" : "white",
                            color: q.status === s ? "white" : "#0f172a",
                            borderColor: q.status === s ? "#0f172a" : "#cbd5e1",
                          }}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => deleteQuote(q.id)}
                      style={{ ...buttonStyle, padding: "5px 12px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}
                    >
                      Delete
                    </button>
                  </div>
                  {q.status === "approved" && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                      ✓ Order created automatically when approved
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [quoteName, setQuoteName] = useState("Spring Promo DTF Quote");
  const [customerName, setCustomerName] = useState("");
  const [salesRep, setSalesRep] = useState("EJ");
  const [garmentType, setGarmentType] = useState("tees");
  const [selectedGarmentId, setSelectedGarmentId] = useState("3001");

  const [frontPrint, setFrontPrint] = useState("1");
  const [backPrint, setBackPrint] = useState("none");
  const [hasSleevePrint, setHasSleevePrint] = useState(false);

  const [frontPrintCost, setFrontPrintCost] = useState(2);
  const [backPrintCost, setBackPrintCost] = useState(4);
  const [frontBackComboCost, setFrontBackComboCost] = useState(6);
  const [sleevePrintCost, setSleevePrintCost] = useState(1.4);

  const [qtyXS, setQtyXS] = useState(0);
  const [qtyS, setQtyS] = useState(0);
  const [qtyM, setQtyM] = useState(0);
  const [qtyL, setQtyL] = useState(0);
  const [qtyXL, setQtyXL] = useState(0);
  const [qty2xl, setQty2xl] = useState(0);
  const [qty3xl, setQty3xl] = useState(0);
  const [qty4xl, setQty4xl] = useState(0);

  const [upcharge2xl, setUpcharge2xl] = useState(2.5);
  const [upcharge3xl, setUpcharge3xl] = useState(3.5);
  const [upcharge4xl, setUpcharge4xl] = useState(4.5);

  const [setupFee, setSetupFee] = useState(35);
  const [artFee, setArtFee] = useState(25);
  const [shippingFee, setShippingFee] = useState(18);
  const [rushFee, setRushFee] = useState(0);
  const [packagingFeePerUnit, setPackagingFeePerUnit] = useState(0);

  const [overheadPct, setOverheadPct] = useState(10);
  const [profitMarginPct, setProfitMarginPct] = useState(38);
  const [salesTaxPct, setSalesTaxPct] = useState(7);
  const [includeTax, setIncludeTax] = useState(true);
  const [ccFeePct, setCcFeePct] = useState(3);
  const [includeCcFee, setIncludeCcFee] = useState(false);
  const [manualPriceEach, setManualPriceEach] = useState("");

  const [tiers] = useState(defaultTiers);
  const [notes, setNotes] = useState(
    "Quote includes standard DTF production. Freight beyond local delivery not included unless listed above. Final invoice may adjust for exact garment availability and size breakdown."
  );

  const [saveStatus, setSaveStatus] = useState(null);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [highlightQuoteId, setHighlightQuoteId] = useState(null);

  const garmentOptions = garmentCatalog[garmentType] || [];
  const selectedGarment = garmentOptions.find((g) => g.id === selectedGarmentId) || garmentOptions[0];

  const totalSizeQty = useMemo(() =>
    safeNum(qtyXS) + safeNum(qtyS) + safeNum(qtyM) + safeNum(qtyL) +
    safeNum(qtyXL) + safeNum(qty2xl) + safeNum(qty3xl) + safeNum(qty4xl),
    [qtyXS, qtyS, qtyM, qtyL, qtyXL, qty2xl, qty3xl, qty4xl]
  );

  const effectiveQuantity = totalSizeQty;
  const selectedTier = useMemo(() => getTierForQty(effectiveQuantity, tiers), [effectiveQuantity, tiers]);

  const garmentCostEach = useMemo(() =>
    Math.max(0, round2(safeNum(selectedGarment?.baseCost))), [selectedGarment]
  );

  const decorationCostEach = useMemo(() => {
    const hasFront = frontPrint !== "none";
    const hasBack = backPrint !== "none";
    let dtfCost = 0;
    if (hasFront && hasBack) dtfCost = safeNum(frontBackComboCost);
    else if (hasFront) dtfCost = safeNum(frontPrintCost);
    else if (hasBack) dtfCost = safeNum(backPrintCost);
    if (hasSleevePrint) dtfCost += safeNum(sleevePrintCost);
    return round2(dtfCost);
  }, [frontPrint, backPrint, hasSleevePrint, frontPrintCost, backPrintCost, frontBackComboCost, sleevePrintCost]);

  const sizeUpchargeTotal = useMemo(() => round2(
    safeNum(qty2xl) * safeNum(upcharge2xl) +
    safeNum(qty3xl) * safeNum(upcharge3xl) +
    safeNum(qty4xl) * safeNum(upcharge4xl)
  ), [qty2xl, qty3xl, qty4xl, upcharge2xl, upcharge3xl, upcharge4xl]);

  const calculations = useMemo(() => {
    const qty = effectiveQuantity;
    const garmentSubtotal = garmentCostEach * qty;
    const decorationSubtotal = decorationCostEach * qty;
    const packagingSubtotal = safeNum(packagingFeePerUnit) * qty;
    const fixedFees = safeNum(setupFee) + safeNum(artFee) + safeNum(shippingFee) + safeNum(rushFee);
    const hardCost = garmentSubtotal + decorationSubtotal + packagingSubtotal + fixedFees + sizeUpchargeTotal;
    const overhead = hardCost * (safeNum(overheadPct) / 100);
    const preProfit = hardCost + overhead;
    const profit = preProfit * (safeNum(profitMarginPct) / 100);
    const subtotal = preProfit + profit;
    const ccFee = includeCcFee ? subtotal * (safeNum(ccFeePct) / 100) : 0;
    const taxableSubtotal = subtotal + ccFee;
    const tax = includeTax ? taxableSubtotal * (safeNum(salesTaxPct) / 100) : 0;
    const finalTotal = taxableSubtotal + tax;
    const rawPrice = qty > 0 ? finalTotal / qty : 0;
    const calculatedPricePerPiece = Math.round(rawPrice * 4) / 4;
    const isManual = manualPriceEach !== "";
    const pricePerPiece = isManual ? safeNum(manualPriceEach) : calculatedPricePerPiece;
    const displaySubtotal = isManual ? pricePerPiece * qty : subtotal;
    const displayTotal = isManual
      ? includeTax ? displaySubtotal * (1 + safeNum(salesTaxPct) / 100) : displaySubtotal
      : finalTotal;
    return {
      garmentSubtotal, decorationSubtotal, packagingSubtotal,
      fixedFees, hardCost, overhead, profit, subtotal,
      ccFee, taxableSubtotal, tax, finalTotal,
      displaySubtotal, calculatedPricePerPiece, pricePerPiece, displayTotal,
    };
  }, [
    effectiveQuantity, garmentCostEach, decorationCostEach, packagingFeePerUnit,
    setupFee, artFee, shippingFee, rushFee, sizeUpchargeTotal,
    overheadPct, profitMarginPct, includeTax, salesTaxPct, manualPriceEach, includeCcFee, ccFeePct,
  ]);

  const garmentTypeLabel = { tees: "Tee", hoodies: "Hoodie", polos: "Polo", bottoms: "Bottom", hats: "Hat" }[garmentType];

  const sizeRunSummary = [
    safeNum(qtyXS) > 0 ? `XS: ${qtyXS}` : null,
    safeNum(qtyS) > 0 ? `S: ${qtyS}` : null,
    safeNum(qtyM) > 0 ? `M: ${qtyM}` : null,
    safeNum(qtyL) > 0 ? `L: ${qtyL}` : null,
    safeNum(qtyXL) > 0 ? `XL: ${qtyXL}` : null,
    safeNum(qty2xl) > 0 ? `2XL: ${qty2xl}` : null,
    safeNum(qty3xl) > 0 ? `3XL: ${qty3xl}` : null,
    safeNum(qty4xl) > 0 ? `4XL: ${qty4xl}` : null,
  ].filter(Boolean).join(" | ");

  const saveQuote = async () => {
    setSaveStatus("saving");
    const { error } = await supabase.from("quotes").insert([{
      quote_name: quoteName, customer_name: customerName, sales_rep: salesRep, status: "draft",
      garment_type: garmentType, garment_id: selectedGarmentId,
      garment_label: selectedGarment?.label || "", garment_cost_each: garmentCostEach,
      qty_xs: safeNum(qtyXS), qty_s: safeNum(qtyS), qty_m: safeNum(qtyM),
      qty_l: safeNum(qtyL), qty_xl: safeNum(qtyXL), qty_2xl: safeNum(qty2xl),
      qty_3xl: safeNum(qty3xl), qty_4xl: safeNum(qty4xl), total_qty: effectiveQuantity,
      front_print: frontPrint, back_print: backPrint, has_sleeve_print: hasSleevePrint,
      decoration_cost_each: decorationCostEach,
      setup_fee: safeNum(setupFee), art_fee: safeNum(artFee),
      shipping_fee: safeNum(shippingFee), rush_fee: safeNum(rushFee),
      packaging_fee_per_unit: safeNum(packagingFeePerUnit),
      overhead_pct: safeNum(overheadPct), profit_margin_pct: safeNum(profitMarginPct),
      sales_tax_pct: safeNum(salesTaxPct), include_tax: includeTax,
      cc_fee_pct: safeNum(ccFeePct), include_cc_fee: includeCcFee,
      hard_cost: round2(calculations.hardCost),
      garment_subtotal: round2(calculations.garmentSubtotal),
      decoration_subtotal: round2(calculations.decorationSubtotal),
      size_upcharge_total: round2(sizeUpchargeTotal),
      packaging_subtotal: round2(calculations.packagingSubtotal),
      fixed_fees: round2(calculations.fixedFees),
      overhead: round2(calculations.overhead),
      profit: round2(calculations.profit),
      subtotal: round2(calculations.subtotal),
      final_total: round2(calculations.finalTotal),
      price_per_piece: round2(calculations.pricePerPiece),
      manual_price_each: manualPriceEach !== "" ? safeNum(manualPriceEach) : null,
      notes,
    }]);
    if (error) { console.error("Save error:", error); setSaveStatus("error"); }
    else setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const resetDefaults = () => {
    setQuoteName("Spring Promo DTF Quote"); setCustomerName(""); setSalesRep("EJ");
    setGarmentType("tees"); setSelectedGarmentId("3001");
    setFrontPrint("1"); setBackPrint("none"); setHasSleevePrint(false);
    setFrontPrintCost(2); setBackPrintCost(4); setFrontBackComboCost(6); setSleevePrintCost(1.4);
    setQtyXS(0); setQtyS(0); setQtyM(0); setQtyL(0); setQtyXL(0);
    setQty2xl(0); setQty3xl(0); setQty4xl(0);
    setUpcharge2xl(2.5); setUpcharge3xl(3.5); setUpcharge4xl(4.5);
    setSetupFee(35); setArtFee(25); setShippingFee(18); setRushFee(0);
    setPackagingFeePerUnit(0); setOverheadPct(10); setProfitMarginPct(38);
    setSalesTaxPct(7); setIncludeTax(true); setCcFeePct(3); setIncludeCcFee(false);
    setManualPriceEach("");
    setNotes("Quote includes standard DTF production. Freight beyond local delivery not included unless listed above. Final invoice may adjust for exact garment availability and size breakdown.");
  };

  const generateQuotePdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const isManual = manualPriceEach !== "";
    const pdfSubtotal = isManual ? calculations.displaySubtotal : calculations.subtotal;
    const pdfCcFee = includeCcFee ? pdfSubtotal * (safeNum(ccFeePct) / 100) : 0;
    const pdfTax = includeTax ? (pdfSubtotal + pdfCcFee) * (safeNum(salesTaxPct) / 100) : 0;
    const pdfTotal = pdfSubtotal + pdfCcFee + pdfTax;

    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("TrueMark Imprint Co.", pageWidth / 2, 18, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(12);
    doc.text("Custom Apparel Quote", pageWidth / 2, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Prepared for: ${customerName || "Client"}`, 14, 38);
    doc.text(`Quote name: ${quoteName}`, 14, 44);
    doc.text(`Sales rep: ${salesRep}`, 14, 50);
    doc.text(`Decoration: DTF`, 14, 56);
    doc.text(`Garment: ${selectedGarment?.label || ""}`, 14, 62);
    doc.text(`Quantity: ${effectiveQuantity}`, 14, 68);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 38, { align: "right" });

    const allSizes = [
      ["XS", qtyXS], ["S", qtyS], ["M", qtyM], ["L", qtyL],
      ["XL", qtyXL], ["2XL", qty2xl], ["3XL", qty3xl], ["4XL", qty4xl],
    ].filter(([, v]) => safeNum(v) > 0);

    autoTable(doc, {
      startY: 75, theme: "grid",
      head: [["Size", ...allSizes.map(([sz]) => sz)]],
      body: [["Qty", ...allSizes.map(([, v]) => String(safeNum(v)))]],
      styles: { fontSize: 10, cellPadding: 4, halign: "center" },
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
      bodyStyles: { fontStyle: "bold" },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6, theme: "grid",
      head: [["Item", "Qty", "Unit Price", "Total"]],
      body: [[
        `${selectedGarment?.label || "Custom Apparel"} - DTF Decoration`,
        effectiveQuantity, currency(pdfSubtotal / effectiveQuantity), currency(pdfSubtotal),
      ]],
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 82 }, 1: { halign: "center", cellWidth: 20 },
        2: { halign: "right", cellWidth: 35 }, 3: { halign: "right", cellWidth: 35 },
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8, theme: "plain",
      body: [
        ["Subtotal", "", currency(pdfSubtotal)],
        ...(includeCcFee ? [[`Credit Card Fee ${ccFeePct}%`, "applied", currency(pdfCcFee)]] : []),
        [`Tax ${includeTax ? `${salesTaxPct}%` : ""}`, includeTax ? "applied" : "Not included", currency(pdfTax)],
        ["Final Total", "", currency(pdfTotal)],
      ],
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: "bold" }, 1: { cellWidth: 85 },
        2: { halign: "right", cellWidth: 35 },
      },
    });

    const tableEndY = doc.lastAutoTable?.finalY || 160;
    doc.setFontSize(11); doc.text("Notes", 14, tableEndY + 14);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(notes || "", 180), 14, tableEndY + 22);
    doc.setFontSize(9);
    doc.text("Thank you for the opportunity to quote your apparel project.", 14, 280);
    doc.save(`${slugify(quoteName)}.pdf`);
  };

  const pdfButtonLabel = saveStatus === "saving" ? "Saving…"
    : saveStatus === "saved" ? "✓ Saved & PDF Generated!"
    : saveStatus === "error" ? "Error — retry"
    : "Generate Customer Quote PDF";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "Inter, Arial, sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div>
              <h1 style={{ display: "flex", alignItems: "center", gap: 12, margin: 0, fontSize: 34, color: "#0f172a" }}>
                <Shirt size={32} color="#0f172a" /> TrueMark Quote Tool
              </h1>
              <p style={{ color: "#475569", marginTop: 8 }}>
                Fast DTF apparel pricing with branded garment presets, size-specific upcharges, and customer-facing quote output.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={buttonStyle} onClick={resetDefaults}>
                <RefreshCcw size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Reset
              </button>
              <button style={buttonStyle} onClick={() => setQuotesOpen(true)}>
                <List size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> View Quotes
              </button>
              <button style={buttonStyle} onClick={() => setOrdersOpen(true)}>
                <ClipboardList size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> View Orders
              </button>
            </div>
          </div>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          <div style={{ display: "grid", gap: 24 }}>
            <div style={cardStyle}>
              <SectionTitle icon={Calculator}>Quote Builder</SectionTitle>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Quote Name"><input style={inputStyle} value={quoteName} onChange={(e) => setQuoteName(e.target.value)} /></Field>
                <Field label="Customer"><input style={inputStyle} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Client / organization" /></Field>
                <Field label="Sales Rep"><input style={inputStyle} value={salesRep} onChange={(e) => setSalesRep(e.target.value)} /></Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Garment Category">
                  <select style={inputStyle} value={garmentType} onChange={(e) => { setGarmentType(e.target.value); setSelectedGarmentId(garmentCatalog[e.target.value][0].id); }}>
                    <option value="tees">Tees/Tanks</option>
                    <option value="hoodies">Hoodies</option>
                    <option value="polos">Polos</option>
                    <option value="bottoms">Bottoms</option>
                    <option value="hats">Hats</option>
                  </select>
                </Field>
                <Field label="Garment Style">
                  <select style={inputStyle} value={selectedGarmentId} onChange={(e) => setSelectedGarmentId(e.target.value)}>
                    {garmentOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </Field>
                <Field label="Total Quantity"><div style={readOnlyStyle}>{effectiveQuantity}</div></Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Front Print">
                  <select style={inputStyle} value={frontPrint} onChange={(e) => setFrontPrint(e.target.value)}>
                    <option value="none">None</option><option value="1">1 Color</option><option value="full">Full Color</option>
                  </select>
                </Field>
                <Field label="Back Print">
                  <select style={inputStyle} value={backPrint} onChange={(e) => setBackPrint(e.target.value)}>
                    <option value="none">None</option><option value="1">1 Color</option><option value="full">Full Color</option>
                  </select>
                </Field>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 600 }}>
                    <input type="checkbox" checked={hasSleevePrint} onChange={(e) => setHasSleevePrint(e.target.checked)} />
                    Additional Sleeve Print Charge
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Front Print Cost"><input style={inputStyle} type="number" value={frontPrintCost} onChange={(e) => setFrontPrintCost(e.target.value)} /></Field>
                <Field label="Back Print Cost"><input style={inputStyle} type="number" value={backPrintCost} onChange={(e) => setBackPrintCost(e.target.value)} /></Field>
                <Field label="Front + Back Combo"><input style={inputStyle} type="number" value={frontBackComboCost} onChange={(e) => setFrontBackComboCost(e.target.value)} /></Field>
                <Field label="Sleeve Print Cost"><input style={inputStyle} type="number" value={sleevePrintCost} onChange={(e) => setSleevePrintCost(e.target.value)} /></Field>
              </div>

              <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Size Breakdown</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  ["XS", qtyXS, setQtyXS], ["S", qtyS, setQtyS], ["M", qtyM, setQtyM],
                  ["L", qtyL, setQtyL], ["XL", qtyXL, setQtyXL], ["2XL", qty2xl, setQty2xl],
                  ["3XL", qty3xl, setQty3xl], ["4XL", qty4xl, setQty4xl],
                ].map(([label, val, setter]) => (
                  <Field key={label} label={label}>
                    <input style={inputStyle} type="number" min="0" value={val} onChange={(e) => setter(e.target.value)} />
                  </Field>
                ))}
              </div>

              <div style={{ marginBottom: 16, color: "#475569", fontSize: 13 }}>
                Total qty: <strong>{totalSizeQty}</strong>
                {sizeRunSummary && <span style={{ marginLeft: 12, color: "#94a3b8" }}>{sizeRunSummary}</span>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="2XL Upcharge"><input style={inputStyle} type="number" value={upcharge2xl} onChange={(e) => setUpcharge2xl(e.target.value)} /></Field>
                <Field label="3XL Upcharge"><input style={inputStyle} type="number" value={upcharge3xl} onChange={(e) => setUpcharge3xl(e.target.value)} /></Field>
                <Field label="4XL Upcharge"><input style={inputStyle} type="number" value={upcharge4xl} onChange={(e) => setUpcharge4xl(e.target.value)} /></Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Setup Fee"><input style={inputStyle} type="number" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} /></Field>
                <Field label="Art Fee"><input style={inputStyle} type="number" value={artFee} onChange={(e) => setArtFee(e.target.value)} /></Field>
                <Field label="Shipping Fee"><input style={inputStyle} type="number" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} /></Field>
                <Field label="Rush Fee"><input style={inputStyle} type="number" value={rushFee} onChange={(e) => setRushFee(e.target.value)} /></Field>
                <Field label="Packaging / Unit"><input style={inputStyle} type="number" value={packagingFeePerUnit} onChange={(e) => setPackagingFeePerUnit(e.target.value)} /></Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Overhead %"><input style={inputStyle} type="number" value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} /></Field>
                <Field label="Profit Margin %"><input style={inputStyle} type="number" value={profitMarginPct} onChange={(e) => setProfitMarginPct(e.target.value)} /></Field>
                <Field label="Sales Tax %"><input style={inputStyle} type="number" value={salesTaxPct} onChange={(e) => setSalesTaxPct(e.target.value)} /></Field>
                <Field label="Credit Card Fee %"><input style={inputStyle} type="number" value={ccFeePct} onChange={(e) => setCcFeePct(e.target.value)} /></Field>
                <Field label="Manual Price / Piece">
                  <input style={inputStyle} type="number" step="0.01" placeholder="Optional" value={manualPriceEach} onChange={(e) => setManualPriceEach(e.target.value)} />
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={includeTax} onChange={(e) => setIncludeTax(e.target.checked)} />
                  Include tax in final quote
                </label>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 600, marginTop: 8 }}>
                  <input type="checkbox" checked={includeCcFee} onChange={(e) => setIncludeCcFee(e.target.checked)} />
                  Include credit card processing fee
                </label>
              </div>

              <Field label="Quote Notes">
                <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </div>

          <div style={{ display: "grid", gap: 24, alignSelf: "start" }}>
            <div style={cardStyle}>
              <SectionTitle icon={Package}>Internal Pricing Summary</SectionTitle>
              <div style={{ background: "#0f172a", color: "white", borderRadius: 20, padding: 20, marginBottom: 18 }}>
                <div style={{ color: "#cbd5e1", fontSize: 14 }}>Sell Price / Piece</div>
                <div style={{ fontSize: 38, fontWeight: 800, marginTop: 8 }}>{currency(calculations.pricePerPiece)}</div>
                <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 8 }}>Total Quote: {currency(calculations.displayTotal)}</div>
              </div>
              <SummaryRow label="Quoted quantity" value={String(effectiveQuantity)} />
              <SummaryRow label="Garment / ea" value={currency(garmentCostEach)} />
              <SummaryRow label="DTF / ea" value={currency(decorationCostEach)} />
              <SummaryRow label="Garment subtotal" value={currency(calculations.garmentSubtotal)} />
              <SummaryRow label="DTF subtotal" value={currency(calculations.decorationSubtotal)} />
              <SummaryRow label="Size upcharges" value={currency(sizeUpchargeTotal)} />
              <SummaryRow label="Packaging subtotal" value={currency(calculations.packagingSubtotal)} />
              <SummaryRow label="Fixed fees" value={currency(calculations.fixedFees)} />
              <SummaryRow label="Overhead" value={currency(calculations.overhead)} />
              <SummaryRow label="Profit" value={currency(calculations.profit)} />
              {manualPriceEach !== "" && (
                <SummaryRow label="Manual pricing active" value={`${effectiveQuantity} × ${currency(manualPriceEach)}`} />
              )}
              <SummaryRow label={manualPriceEach !== "" ? "Manual subtotal" : "Subtotal"} value={currency(manualPriceEach !== "" ? calculations.displaySubtotal : calculations.subtotal)} bold />
              <SummaryRow label="Tax" value={currency(manualPriceEach !== "" ? calculations.displayTotal - calculations.displaySubtotal : calculations.tax)} />
            </div>

            <div style={{ ...cardStyle, border: "2px solid #0f172a" }}>
              <SectionTitle icon={FileText}>Customer Quote Preview</SectionTitle>
              <div style={{ marginBottom: 14 }}>
                <div style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 12, color: "#64748b" }}>Quote</div>
                <h3 style={{ margin: "6px 0 0", fontSize: 28 }}>{quoteName}</h3>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>
                  Prepared for {customerName || "Client"} • Rep: {salesRep}
                </div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, fontSize: 14, marginBottom: 16 }}>
                <SummaryRow label="Garment" value={selectedGarment?.label || ""} />
                <SummaryRow label="Category" value={garmentTypeLabel} />
                <SummaryRow label="Decoration" value="DTF" />
                <SummaryRow label="Total Quantity" value={String(effectiveQuantity)} />
                <SummaryRow
                  label="Print Details"
                  value={`Front: ${frontPrint === "full" ? "Full Color" : frontPrint === "1" ? "1 Color" : "None"} | Back: ${backPrint === "none" ? "None" : backPrint === "full" ? "Full Color" : "1 Color"}${hasSleevePrint ? " | Sleeve" : ""}`}
                />
                <div style={{ paddingTop: 8, borderTop: "1px solid #e2e8f0", marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Size Breakdown</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[
                      ["XS", qtyXS], ["S", qtyS], ["M", qtyM], ["L", qtyL],
                      ["XL", qtyXL], ["2XL", qty2xl], ["3XL", qty3xl], ["4XL", qty4xl],
                    ].map(([label, val]) => (
                      <div key={label} style={{
                        background: safeNum(val) > 0 ? "#0f172a" : "#f1f5f9",
                        color: safeNum(val) > 0 ? "white" : "#94a3b8",
                        borderRadius: 8, padding: "6px 8px", textAlign: "center", fontSize: 12,
                      }}>
                        <div style={{ fontWeight: 700 }}>{label}</div>
                        <div>{safeNum(val) > 0 ? val : "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ background: "#0f172a", color: "white", borderRadius: 20, padding: 20, marginBottom: 16 }}>
                <div style={{ color: "#cbd5e1", fontSize: 14 }}>Quoted Price</div>
                <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>{currency(calculations.pricePerPiece)}</div>
                <div style={{ color: "#cbd5e1", fontSize: 14 }}>per piece</div>
                <div style={{ borderTop: "1px solid #334155", marginTop: 16, paddingTop: 16, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
                  <span>Total Project</span><strong>{currency(calculations.displayTotal)}</strong>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Notes</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>{notes}</div>
              </div>
              <button
                onClick={async () => { await saveQuote(); generateQuotePdf(); }}
                disabled={saveStatus === "saving"}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14, border: "none",
                  background: saveStatus === "saved" ? "#16a34a" : saveStatus === "error" ? "#dc2626" : "#0f172a",
                  color: "white", fontWeight: 700, cursor: "pointer", transition: "background 0.2s",
                }}
              >
                {pdfButtonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SavedQuotesDrawer
        open={quotesOpen}
        onClose={() => { setQuotesOpen(false); setHighlightQuoteId(null); }}
        highlightId={highlightQuoteId}
      />
      <OrdersDrawer
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        onViewQuote={(quoteId) => {
          setHighlightQuoteId(quoteId);
          setOrdersOpen(false);
          setQuotesOpen(true);
        }}
      />
    </div>
  );
}
