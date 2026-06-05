import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import logo from "./assets/TrueMark Single logo.png";
import autoTable from "jspdf-autotable";
import { Calculator, Shirt, RefreshCcw, Package, FileText, List, X, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, ClipboardList, Search } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zbnpewjafbztidohytjh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpibnBld2phZmJ6dGlkb2h5dGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODU5ODQsImV4cCI6MjA5NTE2MTk4NH0.iblJDKPf5oS1M695FmjRDaG3AQES0l_QM-3eiBoBlbg"
);

const ORDER_STAGES = [
  "Order Created","Materials Ordered","In Production","Quality Check",
  "Ready","Pickup / Shipped / Delivered","Completed",
];

const SIZE_ORDER = ["XS","S","M","L","XL","2XL","3XL","4XL","5XL","6XL","LT","XLT","2XLT","3XLT","4XLT"];

const defaultTiers = [
  { minQty: 1,   maxQty: 11,   garmentCostAdj: 0 },
  { minQty: 12,  maxQty: 23,   garmentCostAdj: -0.15 },
  { minQty: 24,  maxQty: 47,   garmentCostAdj: -0.35 },
  { minQty: 48,  maxQty: 99,   garmentCostAdj: -0.65 },
  { minQty: 100, maxQty: 249,  garmentCostAdj: -0.85 },
  { minQty: 250, maxQty: 9999, garmentCostAdj: -1.1 },
];

const cardStyle = { background:"white", borderRadius:20, padding:24, boxShadow:"0 8px 30px rgba(15,23,42,0.08)", border:"1px solid #e2e8f0" };
const inputStyle = { width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid #cbd5e1", fontSize:14, boxSizing:"border-box" };
const readOnlyStyle = { ...inputStyle, background:"#f1f5f9", color:"#0f172a", display:"flex", alignItems:"center", minHeight:42 };
const labelStyle = { display:"block", fontSize:13, fontWeight:600, color:"#334155", marginBottom:8 };
const buttonStyle = { padding:"10px 14px", borderRadius:12, border:"1px solid #cbd5e1", background:"white", color:"#0f172a", cursor:"pointer", fontWeight:600 };

function currency(v) { return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0)); }
function safeNum(v) { const p=parseFloat(v); return Number.isFinite(p)?p:0; }
function round2(n) { return Math.round(n*100)/100; }
function slugify(v) { return (v||"quote").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
function getTierForQty(qty,tiers) { return tiers.find(t=>qty>=safeNum(t.minQty)&&qty<=safeNum(t.maxQty)); }

function SectionTitle({icon:Icon,children}) {
  return <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><Icon size={20}/><h2 style={{margin:0,fontSize:22}}>{children}</h2></div>;
}
function Field({label,children}) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }
function SummaryRow({label,value,bold=false}) {
  return <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:14,borderTop:bold?"1px solid #e2e8f0":"none",marginTop:bold?8:0,fontWeight:bold?700:500}}>
    <span style={{color:bold?"#0f172a":"#475569"}}>{label}</span><span>{value}</span>
  </div>;
}

function StatusBadge({status}) {
  const config={draft:{color:"#64748b",bg:"#f1f5f9",icon:Clock,label:"Draft"},sent:{color:"#d97706",bg:"#fef3c7",icon:Clock,label:"Sent"},approved:{color:"#16a34a",bg:"#dcfce7",icon:CheckCircle,label:"Approved"},declined:{color:"#dc2626",bg:"#fee2e2",icon:XCircle,label:"Declined"}}[status]||{color:"#64748b",bg:"#f1f5f9",icon:Clock,label:status};
  const Icon=config.icon;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:12,fontWeight:600,color:config.color,background:config.bg}}><Icon size={12}/>{config.label}</span>;
}

function StageBadge({stage}) {
  const c={
    "Order Created":{color:"#0369a1",bg:"#e0f2fe"},"In Production":{color:"#7c3aed",bg:"#ede9fe"},
    "Quality Check":{color:"#d97706",bg:"#fef3c7"},"Ready":{color:"#16a34a",bg:"#dcfce7"},
    "Pickup / Shipped / Delivered":{color:"#0f172a",bg:"#f1f5f9"},"Completed":{color:"#16a34a",bg:"#dcfce7"},
    "Cancelled":{color:"#dc2626",bg:"#fee2e2"},
  }[stage]||{color:"#64748b",bg:"#f1f5f9"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:12,fontWeight:600,color:c.color,background:c.bg}}>{stage}</span>;
}

// ── SanMar Product Search ─────────────────────────────────────────────────────
function SanMarSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); setShowResults(false); return; }
    setLoading(true);
    // Get distinct styles matching query
    const { data, error } = await supabase
      .from("sanmar_products")
      .select("style, product_title, brand, category, piece_price, color_name")
      .or(`style.ilike.%${q}%,product_title.ilike.%${q}%,brand.ilike.%${q}%`)
      .in("product_status", ["Regular","Active","New"])
      .order("style")
      .limit(100);

    if (!error && data) {
      // Deduplicate by style — pick lowest piece_price per style as base
      const styleMap = {};
      data.forEach(row => {
        if (!styleMap[row.style]) {
          styleMap[row.style] = { style: row.style, product_title: row.product_title, brand: row.brand, category: row.category, base_price: parseFloat(row.piece_price) };
        } else {
          const p = parseFloat(row.piece_price);
          if (p < styleMap[row.style].base_price) styleMap[row.style].base_price = p;
        }
      });
      setResults(Object.values(styleMap).slice(0, 20));
      setShowResults(true);
    }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 350);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", pointerEvents:"none" }} />
        <input
          style={{ ...inputStyle, paddingLeft: 36 }}
          placeholder="Search by style # (PC61) or keyword (bella canvas tee)…"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
      </div>
      {loading && <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>Searching…</div>}
      {showResults && results.length > 0 && (
        <div style={{ position:"absolute", zIndex:999, top:"100%", left:0, right:0, background:"white", border:"1px solid #e2e8f0", borderRadius:12, boxShadow:"0 8px 30px rgba(0,0,0,0.12)", maxHeight:320, overflowY:"auto", marginTop:4 }}>
          {results.map(r => (
            <div
              key={r.style}
              onMouseDown={() => { onSelect(r); setQuery(`${r.style} — ${r.product_title}`); setShowResults(false); }}
              style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}
              onMouseEnter={e => e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background="white"}
            >
              <div>
                <span style={{ fontWeight:700, fontSize:13, color:"#0f172a", marginRight:8 }}>{r.style}</span>
                <span style={{ fontSize:13, color:"#475569" }}>{r.product_title}</span>
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{r.brand} · {r.category?.split(";")[0]}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginLeft:12, whiteSpace:"nowrap" }}>from {currency(r.base_price)}</div>
            </div>
          ))}
        </div>
      )}
      {showResults && results.length === 0 && !loading && query.length >= 2 && (
        <div style={{ position:"absolute", zIndex:999, top:"100%", left:0, right:0, background:"white", border:"1px solid #e2e8f0", borderRadius:12, padding:"12px 14px", fontSize:13, color:"#64748b", marginTop:4 }}>
          No products found for "{query}"
        </div>
      )}
    </div>
  );
}

// ── Color + Size Picker (after style selected) ────────────────────────────────
function SanMarColorSizePicker({ selectedStyle, onColorSelect, onSizeQtyChange, sizeQtys }) {
  const [colors, setColors] = useState([]);
  const [selectedColor, setSelectedColor] = useState("");
  const [sizePrices, setSizePrices] = useState({});
  const [loadingColors, setLoadingColors] = useState(false);
  const [loadingSizes, setLoadingSizes] = useState(false);

  // Load colors when style changes
  useEffect(() => {
    if (!selectedStyle) return;
    setLoadingColors(true);
    setSelectedColor("");
    setSizePrices({});
    supabase
      .from("sanmar_products")
      .select("color_name")
      .eq("style", selectedStyle)
      .in("product_status", ["Regular","Active","New"])
      .order("color_name")
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(r => r.color_name))];
          setColors(unique);
        }
        setLoadingColors(false);
      });
  }, [selectedStyle]);

  // Load sizes + prices when color changes
  useEffect(() => {
    if (!selectedStyle || !selectedColor) return;
    setLoadingSizes(true);
    supabase
      .from("sanmar_products")
      .select("size, piece_price, size_index")
      .eq("style", selectedStyle)
      .eq("color_name", selectedColor)
      .in("product_status", ["Regular","Active","New"])
      .then(({ data }) => {
        if (data) {
          const priceMap = {};
          data.forEach(r => { priceMap[r.size] = parseFloat(r.piece_price); });
          setSizePrices(priceMap);
          onColorSelect(selectedColor, priceMap);
        }
        setLoadingSizes(false);
      });
  }, [selectedColor, selectedStyle]);

  const sortedSizes = Object.keys(sizePrices).sort((a,b) => {
    const ai = SIZE_ORDER.indexOf(a); const bi = SIZE_ORDER.indexOf(b);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });

  if (!selectedStyle) return null;

  return (
    <div style={{ marginTop:16 }}>
      <Field label="Color">
        {loadingColors
          ? <div style={{ fontSize:13, color:"#64748b" }}>Loading colors…</div>
          : <select style={inputStyle} value={selectedColor} onChange={e => setSelectedColor(e.target.value)}>
              <option value="">— Select a color —</option>
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        }
      </Field>

      {selectedColor && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", marginBottom:10 }}>Size Breakdown</div>
          {loadingSizes
            ? <div style={{ fontSize:13, color:"#64748b" }}>Loading sizes…</div>
            : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))", gap:10 }}>
                {sortedSizes.map(size => (
                  <div key={size} style={{ background:"#f8fafc", borderRadius:10, padding:"8px 10px", border:"1px solid #e2e8f0" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:13 }}>{size}</span>
                      <span style={{ fontSize:11, color:"#64748b" }}>{currency(sizePrices[size])}</span>
                    </div>
                    <input
                      type="number" min="0"
                      style={{ ...inputStyle, padding:"4px 8px", fontSize:13 }}
                      value={sizeQtys[size] || ""}
                      placeholder="0"
                      onChange={e => onSizeQtyChange(size, e.target.value, sizePrices[size])}
                    />
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

// ── Password Screen ───────────────────────────────────────────────────────────
function PasswordScreen({onAuth}) {
  const [pwInput,setPwInput]=useState(""); const [pwError,setPwError]=useState(false);
  const attempt=()=>{ if(pwInput==="connect.Me!234") onAuth(); else setPwError(true); };
  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter, Arial, sans-serif"}}>
      <div style={{background:"white",borderRadius:20,padding:40,boxShadow:"0 8px 30px rgba(15,23,42,0.08)",border:"1px solid #e2e8f0",width:340}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><Shirt size={28} color="#0f172a"/><h2 style={{margin:0,fontSize:22,color:"#0f172a"}}>TrueMark Quote Tool</h2></div>
        <label style={{display:"block",fontSize:13,fontWeight:600,color:"#334155",marginBottom:8}}>Password</label>
        <input type="password" style={{width:"100%",padding:"10px 12px",borderRadius:12,border:pwError?"1px solid #dc2626":"1px solid #cbd5e1",fontSize:14,boxSizing:"border-box",marginBottom:12}} value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>{if(e.key==="Enter")attempt();}} placeholder="Enter password" autoFocus/>
        {pwError&&<div style={{color:"#dc2626",fontSize:13,marginBottom:12}}>Incorrect password</div>}
        <button onClick={attempt} style={{width:"100%",padding:"11px",borderRadius:12,border:"none",background:"#0f172a",color:"white",fontWeight:700,cursor:"pointer",fontSize:14}}>Sign In</button>
      </div>
    </div>
  );
}

// ── Orders Drawer ─────────────────────────────────────────────────────────────
function OrdersDrawer({open,onClose,onViewQuote}) {
  const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(false); const [expandedId,setExpandedId]=useState(null);
  useEffect(()=>{if(open)fetchOrders();},[open]);
  async function fetchOrders(){setLoading(true);const{data,error}=await supabase.from("orders").select("*").order("created_at",{ascending:false});if(!error)setOrders(data||[]);setLoading(false);}
  async function updateStage(id,stage){await supabase.from("orders").update({stage,stage_updated_at:new Date().toISOString()}).eq("id",id);fetchOrders();}
  async function deleteOrder(id){if(!window.confirm("Delete this order? This can't be undone."))return;await supabase.from("orders").delete().eq("id",id);if(expandedId===id)setExpandedId(null);fetchOrders();}
  if(!open)return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)"}}/>
      <motion.div initial={{x:"100%"}} animate={{x:0}} transition={{type:"spring",damping:28,stiffness:260}}
        style={{position:"relative",width:580,maxWidth:"95vw",background:"white",height:"100%",overflowY:"auto",padding:28,boxShadow:"-8px 0 40px rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{margin:0,fontSize:22}}>Active Orders</h2>
          <button onClick={onClose} style={{...buttonStyle,padding:"6px 10px"}}><X size={18}/></button>
        </div>
        {loading&&<p style={{color:"#64748b"}}>Loading orders…</p>}
        {!loading&&orders.length===0&&<p style={{color:"#64748b"}}>No orders yet. Mark a quote as Approved to create an order.</p>}
        {orders.map(o=>{
          const isOpen=expandedId===o.id; const currentStageIdx=ORDER_STAGES.indexOf(o.stage);
          return (
            <div key={o.id} style={{border:"1px solid #e2e8f0",borderRadius:16,marginBottom:12,background:"#fafafa",overflow:"hidden"}}>
              <div onClick={()=>setExpandedId(isOpen?null:o.id)} style={{padding:"14px 18px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:isOpen?"#f1f5f9":"#fafafa",borderBottom:isOpen?"1px solid #e2e8f0":"none"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <span style={{fontWeight:800,fontSize:14,color:"#0f172a",fontFamily:"monospace"}}>{o.order_number}</span>
                    <span style={{fontWeight:600,fontSize:15,color:"#0f172a"}}>{o.quote_name}</span>
                  </div>
                  <div style={{fontSize:12,color:"#64748b"}}>{o.customer_name||"No customer"} · Qty: {o.total_qty} · {currency(o.final_total)}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginLeft:12}}><StageBadge stage={o.stage}/>{isOpen?<ChevronUp size={16} color="#64748b"/>:<ChevronDown size={16} color="#64748b"/>}</div>
              </div>
              {isOpen&&(
                <div style={{padding:18}}>
                  <div style={{background:"#0f172a",color:"white",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
                    <div><div style={{color:"#94a3b8",fontSize:11}}>ORDER</div><div style={{fontWeight:800,fontSize:18,fontFamily:"monospace"}}>{o.order_number}</div></div>
                    <div style={{textAlign:"center"}}><div style={{color:"#94a3b8",fontSize:11}}>PRICE / PC</div><div style={{fontWeight:700,fontSize:16}}>{currency(o.price_per_piece)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{color:"#94a3b8",fontSize:11}}>TOTAL</div><div style={{fontWeight:700,fontSize:16}}>{currency(o.final_total)}</div></div>
                  </div>
                  <div style={{background:"white",borderRadius:12,padding:"8px 12px",border:"1px solid #e2e8f0",marginBottom:14,fontSize:13}}>
                    {[["Customer",o.customer_name||"—"],["Garment",o.garment_label||"—"],["Quantity",o.total_qty],["Sales Rep",o.sales_rep],["Created",new Date(o.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})],["Stage Updated",new Date(o.stage_updated_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})]].map(([label,value])=>(
                      <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f1f5f9"}}><span style={{color:"#475569"}}>{label}</span><span style={{fontWeight:600}}>{value}</span></div>
                    ))}
                  </div>
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#334155"}}>Production Stage</div>
                      <button onClick={()=>updateStage(o.id,"Cancelled")} style={{...buttonStyle,padding:"4px 12px",fontSize:12,color:"#dc2626",borderColor:"#fca5a5",background:o.stage==="Cancelled"?"#fee2e2":"white"}}>Cancel Order</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {ORDER_STAGES.map((stage,idx)=>(
                        <button key={stage} onClick={()=>updateStage(o.id,stage)} style={{...buttonStyle,padding:"8px 14px",fontSize:13,textAlign:"left",background:o.stage===stage?"#0f172a":idx<currentStageIdx?"#f8fafc":"white",color:o.stage===stage?"white":idx<currentStageIdx?"#94a3b8":"#0f172a",borderColor:o.stage===stage?"#0f172a":"#e2e8f0",display:"flex",alignItems:"center",gap:8}}>
                          <span style={{width:20,height:20,borderRadius:"50%",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",background:o.stage===stage?"white":idx<currentStageIdx?"#cbd5e1":"#e2e8f0",color:o.stage===stage?"#0f172a":"#64748b",flexShrink:0}}>{idx<currentStageIdx?"✓":idx+1}</span>
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={()=>{onViewQuote(o.quote_id);onClose();}} style={{...buttonStyle,width:"100%",marginBottom:10,fontSize:13,textAlign:"center"}}>View Original Quote</button>
                  <button onClick={()=>deleteOrder(o.id)} style={{...buttonStyle,width:"100%",fontSize:13,color:"#dc2626",borderColor:"#fca5a5"}}>Delete Order</button>
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Saved Quotes Drawer ───────────────────────────────────────────────────────
function SavedQuotesDrawer({open,onClose,highlightId}) {
  const [quotes,setQuotes]=useState([]); const [loading,setLoading]=useState(false); const [expandedId,setExpandedId]=useState(null);
  useEffect(()=>{if(open)fetchQuotes();},[open]);
  useEffect(()=>{if(highlightId)setExpandedId(highlightId);},[highlightId]);
  async function fetchQuotes(){setLoading(true);const{data,error}=await supabase.from("quotes").select("*").order("created_at",{ascending:false});if(!error)setQuotes(data||[]);setLoading(false);}
  async function updateStatus(id,status){if(status==="approved"){const quote=quotes.find(q=>q.id===id);if(quote)await createOrder(quote);}await supabase.from("quotes").update({status}).eq("id",id);fetchQuotes();}
  async function createOrder(quote){const{data:seqData}=await supabase.rpc("next_order_number");const orderNumber=seqData||"TM-000";await supabase.from("orders").insert([{order_number:orderNumber,quote_id:quote.id,quote_name:quote.quote_name,customer_name:quote.customer_name,sales_rep:quote.sales_rep,garment_label:quote.garment_label,total_qty:quote.total_qty,price_per_piece:quote.price_per_piece,final_total:quote.final_total,stage:"Order Created",notes:quote.notes}]);}
  async function deleteQuote(id){if(!window.confirm("Delete this quote? This can't be undone."))return;await supabase.from("quotes").delete().eq("id",id);if(expandedId===id)setExpandedId(null);fetchQuotes();}
  if(!open)return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)"}}/>
      <motion.div initial={{x:"100%"}} animate={{x:0}} transition={{type:"spring",damping:28,stiffness:260}}
        style={{position:"relative",width:560,maxWidth:"95vw",background:"white",height:"100%",overflowY:"auto",padding:28,boxShadow:"-8px 0 40px rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{margin:0,fontSize:22}}>Saved Quotes</h2>
          <button onClick={onClose} style={{...buttonStyle,padding:"6px 10px"}}><X size={18}/></button>
        </div>
        {loading&&<p style={{color:"#64748b"}}>Loading quotes…</p>}
        {!loading&&quotes.length===0&&<p style={{color:"#64748b"}}>No saved quotes yet.</p>}
        {quotes.map(q=>{
          const isOpen=expandedId===q.id;
          return (
            <div key={q.id} style={{border:isOpen&&highlightId===q.id?"2px solid #0f172a":"1px solid #e2e8f0",borderRadius:16,marginBottom:12,background:"#fafafa",overflow:"hidden"}}>
              <div onClick={()=>setExpandedId(isOpen?null:q.id)} style={{padding:"14px 18px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:isOpen?"#f1f5f9":"#fafafa",borderBottom:isOpen?"1px solid #e2e8f0":"none"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#0f172a"}}>{q.quote_name}</div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{q.customer_name||"No customer"} · {new Date(q.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · Qty: {q.total_qty} · {currency(q.price_per_piece)}/pc</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginLeft:12}}><StatusBadge status={q.status}/>{isOpen?<ChevronUp size={16} color="#64748b"/>:<ChevronDown size={16} color="#64748b"/>}</div>
              </div>
              {isOpen&&(
                <div style={{padding:18}}>
                  <div style={{background:"#f8fafc",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#475569"}}>
                    <span style={{fontWeight:600,color:"#0f172a",marginRight:8}}>Size breakdown saved with quote</span>
                    <span style={{fontWeight:600,color:"#0f172a",marginLeft:8}}>(Total: {q.total_qty})</span>
                  </div>
                  <div style={{background:"#0f172a",color:"white",borderRadius:14,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{color:"#94a3b8",fontSize:11}}>PRICE / PC</div><div style={{fontWeight:800,fontSize:22}}>{currency(q.price_per_piece)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{color:"#94a3b8",fontSize:11}}>TOTAL</div><div style={{fontWeight:700,fontSize:16}}>{currency(q.final_total)}</div></div>
                  </div>
                  <div style={{background:"white",borderRadius:12,padding:"8px 12px",border:"1px solid #e2e8f0",marginBottom:12}}>
                    {[["Garment",q.garment_label||q.garment_type],["Quoted Quantity",q.total_qty],["Garment / ea",currency(q.garment_cost_each)],["DTF / ea",currency(q.decoration_cost_each)],["Garment Subtotal",currency(q.garment_subtotal)],["DTF Subtotal",currency(q.decoration_subtotal)],["Size Upcharges",currency(q.size_upcharge_total)],["Packaging Subtotal",currency(q.packaging_subtotal)],["Fixed Fees",currency(q.fixed_fees)],["Hard Cost",currency(q.hard_cost)],["Overhead ("+q.overhead_pct+"%)",currency(q.overhead)],["Profit ("+q.profit_margin_pct+"%)",currency(q.profit)]].map(([label,value])=>(
                      <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:"1px solid #f1f5f9"}}><span style={{color:"#475569"}}>{label}</span><span style={{fontWeight:600,color:"#0f172a"}}>{value}</span></div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13,fontWeight:700}}><span>Subtotal</span><span>{currency(q.subtotal)}</span></div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {["draft","sent","approved","declined"].map(s=>(
                        <button key={s} onClick={()=>updateStatus(q.id,s)} style={{...buttonStyle,padding:"5px 12px",fontSize:12,background:q.status===s?"#0f172a":"white",color:q.status===s?"white":"#0f172a",borderColor:q.status===s?"#0f172a":"#cbd5e1"}}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
                      ))}
                    </div>
                    <button onClick={()=>deleteQuote(q.id)} style={{...buttonStyle,padding:"5px 12px",fontSize:12,color:"#dc2626",borderColor:"#fca5a5"}}>Delete</button>
                  </div>
                  {q.status==="approved"&&<div style={{marginTop:10,fontSize:12,color:"#16a34a",fontWeight:600}}>✓ Order created automatically when approved</div>}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authed,setAuthed]=useState(false);
  const [quoteName,setQuoteName]=useState("Spring Promo DTF Quote");
  const [customerName,setCustomerName]=useState("");
  const [salesRep,setSalesRep]=useState("EJ");

  // Garment — SanMar or one-off
  const [isOneOff,setIsOneOff]=useState(false);
  const [selectedStyle,setSelectedStyle]=useState(null); // { style, product_title, brand }
  const [selectedColor,setSelectedColor]=useState("");
  const [sizeQtys,setSizeQtys]=useState({}); // { "S": 12, "M": 24, ... }
  const [sizePrices,setSizePrices]=useState({}); // { "S": 4.12, "M": 4.12, "2XL": 5.67 }
  // One-off fields
  const [oneOffName,setOneOffName]=useState("");
  const [oneOffCost,setOneOffCost]=useState("");
  const [oneOffSizes,setOneOffSizes]=useState({XS:0,S:0,M:0,L:0,XL:0,"2XL":0,"3XL":0,"4XL":0});

  // Decoration
  const [frontPrint,setFrontPrint]=useState("1");
  const [backPrint,setBackPrint]=useState("none");
  const [hasSleevePrint,setHasSleevePrint]=useState(false);
  const [frontPrintCost,setFrontPrintCost]=useState(2);
  const [backPrintCost,setBackPrintCost]=useState(4);
  const [frontBackComboCost,setFrontBackComboCost]=useState(6);
  const [sleevePrintCost,setSleevePrintCost]=useState(1.4);

  // Fees
  const [setupFee,setSetupFee]=useState(35);
  const [artFee,setArtFee]=useState(25);
  const [shippingFee,setShippingFee]=useState(18);
  const [rushFee,setRushFee]=useState(0);
  const [packagingFeePerUnit,setPackagingFeePerUnit]=useState(0);
  const [overheadPct,setOverheadPct]=useState(10);
  const [profitMarginPct,setProfitMarginPct]=useState(38);
  const [salesTaxPct,setSalesTaxPct]=useState(7);
  const [includeTax,setIncludeTax]=useState(true);
  const [ccFeePct,setCcFeePct]=useState(3);
  const [includeCcFee,setIncludeCcFee]=useState(false);
  const [manualPriceEach,setManualPriceEach]=useState("");
  const [notes,setNotes]=useState("Quote includes standard DTF production. Freight beyond local delivery not included unless listed above. Final invoice may adjust for exact garment availability and size breakdown.");
  const [saveStatus,setSaveStatus]=useState(null);
  const [quotesOpen,setQuotesOpen]=useState(false);
  const [ordersOpen,setOrdersOpen]=useState(false);
  const [highlightQuoteId,setHighlightQuoteId]=useState(null);
  const [tiers]=useState(defaultTiers);

  // ── Calculations ────────────────────────────────────────────────────────────
  const allSizeEntries = isOneOff
    ? Object.entries(oneOffSizes).filter(([,v])=>safeNum(v)>0)
    : Object.entries(sizeQtys).filter(([,v])=>safeNum(v)>0);

  const totalQty = allSizeEntries.reduce((s,[,v])=>s+safeNum(v),0);

  // Weighted average garment cost across sizes (SanMar prices vary by size)
  const garmentCostEach = useMemo(()=>{
    if(isOneOff) return safeNum(oneOffCost);
    if(!Object.keys(sizePrices).length || totalQty===0) return 0;
    const weighted = allSizeEntries.reduce((s,[sz,qty])=>{
      const price = sizePrices[sz] || 0;
      return s + price * safeNum(qty);
    },0);
    return round2(weighted/totalQty);
  },[isOneOff,oneOffCost,sizePrices,sizeQtys,totalQty]);

  const sizeUpchargeTotal = 0; // SanMar prices already include size upcharges

  const decorationCostEach=(()=>{
    const hasFront=frontPrint!=="none"; const hasBack=backPrint!=="none";
    let dtfCost=0;
    if(hasFront&&hasBack) dtfCost=safeNum(frontBackComboCost);
    else if(hasFront) dtfCost=safeNum(frontPrintCost);
    else if(hasBack) dtfCost=safeNum(backPrintCost);
    if(hasSleevePrint) dtfCost+=safeNum(sleevePrintCost);
    return round2(dtfCost);
  })();

  const qty=totalQty;
  const garmentSubtotal=garmentCostEach*qty;
  const decorationSubtotal=decorationCostEach*qty;
  const packagingSubtotal=safeNum(packagingFeePerUnit)*qty;
  const fixedFees=safeNum(setupFee)+safeNum(artFee)+safeNum(shippingFee)+safeNum(rushFee);
  const hardCost=garmentSubtotal+decorationSubtotal+packagingSubtotal+fixedFees+sizeUpchargeTotal;
  const overhead=hardCost*(safeNum(overheadPct)/100);
  const preProfit=hardCost+overhead;
  const profit=preProfit*(safeNum(profitMarginPct)/100);
  const subtotal=preProfit+profit;
  const ccFee=includeCcFee?subtotal*(safeNum(ccFeePct)/100):0;
  const taxableSubtotal=subtotal+ccFee;
  const tax=includeTax?taxableSubtotal*(safeNum(salesTaxPct)/100):0;
  const finalTotal=taxableSubtotal+tax;
  const rawPrice=qty>0?finalTotal/qty:0;
  const calculatedPricePerPiece=Math.round(rawPrice*4)/4;
  const isManual=manualPriceEach!=="";
  const pricePerPiece=isManual?safeNum(manualPriceEach):calculatedPricePerPiece;
  const displaySubtotal=isManual?pricePerPiece*qty:subtotal;
  const displayTotal=isManual?(includeTax?displaySubtotal*(1+safeNum(salesTaxPct)/100):displaySubtotal):finalTotal;

  const garmentLabel = isOneOff
    ? (oneOffName||"Custom Item")
    : selectedStyle
      ? `${selectedStyle.style} — ${selectedStyle.product_title}${selectedColor?` (${selectedColor})`:""}`
      : "No garment selected";

  const handleStyleSelect = (styleObj) => {
    setSelectedStyle(styleObj);
    setSelectedColor("");
    setSizeQtys({});
    setSizePrices({});
  };

  const handleColorSelect = (color, prices) => {
    setSelectedColor(color);
    setSizePrices(prices);
    setSizeQtys({});
  };

  const handleSizeQtyChange = (size, qty) => {
    setSizeQtys(prev => ({ ...prev, [size]: qty }));
  };

  if(!authed) return <PasswordScreen onAuth={()=>setAuthed(true)}/>;

  const resetDefaults=()=>{
    setQuoteName("Spring Promo DTF Quote"); setCustomerName(""); setSalesRep("EJ");
    setIsOneOff(false); setSelectedStyle(null); setSelectedColor(""); setSizeQtys({}); setSizePrices({});
    setOneOffName(""); setOneOffCost(""); setOneOffSizes({XS:0,S:0,M:0,L:0,XL:0,"2XL":0,"3XL":0,"4XL":0});
    setFrontPrint("1"); setBackPrint("none"); setHasSleevePrint(false);
    setFrontPrintCost(2); setBackPrintCost(4); setFrontBackComboCost(6); setSleevePrintCost(1.4);
    setSetupFee(35); setArtFee(25); setShippingFee(18); setRushFee(0);
    setPackagingFeePerUnit(0); setOverheadPct(10); setProfitMarginPct(38);
    setSalesTaxPct(7); setIncludeTax(true); setCcFeePct(3); setIncludeCcFee(false);
    setManualPriceEach("");
    setNotes("Quote includes standard DTF production. Freight beyond local delivery not included unless listed above. Final invoice may adjust for exact garment availability and size breakdown.");
  };

  const saveQuote=async()=>{
    setSaveStatus("saving");
    const sizeData = isOneOff ? oneOffSizes : Object.fromEntries(
      ["XS","S","M","L","XL","2XL","3XL","4XL"].map(s=>[s, sizeQtys[s]||0])
    );
    const{error}=await supabase.from("quotes").insert([{
      quote_name:quoteName, customer_name:customerName, sales_rep:salesRep, status:"draft",
      garment_type: isOneOff?"one-off":"sanmar",
      garment_id: isOneOff?"one-off":(selectedStyle?.style||""),
      garment_label: garmentLabel,
      garment_cost_each:garmentCostEach,
      qty_xs:safeNum(sizeData.XS), qty_s:safeNum(sizeData.S), qty_m:safeNum(sizeData.M),
      qty_l:safeNum(sizeData.L), qty_xl:safeNum(sizeData.XL), qty_2xl:safeNum(sizeData["2XL"]),
      qty_3xl:safeNum(sizeData["3XL"]), qty_4xl:safeNum(sizeData["4XL"]), total_qty:qty,
      front_print:frontPrint, back_print:backPrint, has_sleeve_print:hasSleevePrint,
      decoration_cost_each:decorationCostEach,
      setup_fee:safeNum(setupFee), art_fee:safeNum(artFee),
      shipping_fee:safeNum(shippingFee), rush_fee:safeNum(rushFee),
      packaging_fee_per_unit:safeNum(packagingFeePerUnit),
      overhead_pct:safeNum(overheadPct), profit_margin_pct:safeNum(profitMarginPct),
      sales_tax_pct:safeNum(salesTaxPct), include_tax:includeTax,
      cc_fee_pct:safeNum(ccFeePct), include_cc_fee:includeCcFee,
      hard_cost:round2(hardCost), garment_subtotal:round2(garmentSubtotal),
      decoration_subtotal:round2(decorationSubtotal), size_upcharge_total:0,
      packaging_subtotal:round2(packagingSubtotal), fixed_fees:round2(fixedFees),
      overhead:round2(overhead), profit:round2(profit), subtotal:round2(subtotal),
      final_total:round2(finalTotal), price_per_piece:round2(pricePerPiece),
      manual_price_each:manualPriceEach!==""?safeNum(manualPriceEach):null,
      notes,
    }]);
    if(error){console.error("Save error:",error);setSaveStatus("error");}
    else setSaveStatus("saved");
    setTimeout(()=>setSaveStatus(null),3000);
  };

  const generateQuotePdf=()=>{
    const doc=new jsPDF(); const pageWidth=doc.internal.pageSize.getWidth();
    const pdfSubtotal=isManual?displaySubtotal:subtotal;
    const pdfCcFee=includeCcFee?pdfSubtotal*(safeNum(ccFeePct)/100):0;
    const pdfTax=includeTax?(pdfSubtotal+pdfCcFee)*(safeNum(salesTaxPct)/100):0;
    const pdfTotal=pdfSubtotal+pdfCcFee+pdfTax;
    doc.setFont("helvetica","bold"); doc.setFontSize(22);
    doc.text("TrueMark Imprint Co.",pageWidth/2,18,{align:"center"});
    doc.setFont("helvetica","normal"); doc.setFontSize(12);
    doc.text("Custom Apparel Quote",pageWidth/2,25,{align:"center"});
    doc.setFontSize(10);
    doc.text(`Prepared for: ${customerName||"Client"}`,14,38);
    doc.text(`Quote name: ${quoteName}`,14,44);
    doc.text(`Sales rep: ${salesRep}`,14,50);
    doc.text(`Decoration: DTF`,14,56);
    doc.text(`Garment: ${garmentLabel}`,14,62);
    doc.text(`Quantity: ${qty}`,14,68);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`,pageWidth-14,38,{align:"right"});
    const displaySizes = isOneOff
      ? Object.entries(oneOffSizes).filter(([,v])=>safeNum(v)>0).sort(([a],[b])=>(SIZE_ORDER.indexOf(a)===-1?99:SIZE_ORDER.indexOf(a))-(SIZE_ORDER.indexOf(b)===-1?99:SIZE_ORDER.indexOf(b)))
      : Object.entries(sizeQtys).filter(([,v])=>safeNum(v)>0).sort(([a],[b])=>(SIZE_ORDER.indexOf(a)===-1?99:SIZE_ORDER.indexOf(a))-(SIZE_ORDER.indexOf(b)===-1?99:SIZE_ORDER.indexOf(b)));
    autoTable(doc,{startY:75,theme:"grid",head:[["Size",...displaySizes.map(([sz])=>sz)]],body:[["Qty",...displaySizes.map(([,v])=>String(safeNum(v)))]],styles:{fontSize:10,cellPadding:4,halign:"center"},headStyles:{fillColor:[15,23,42],fontStyle:"bold"},bodyStyles:{fontStyle:"bold"}});
    autoTable(doc,{startY:doc.lastAutoTable.finalY+6,theme:"grid",head:[["Item","Qty","Unit Price","Total"]],body:[[garmentLabel,qty,currency(pdfSubtotal/qty||0),currency(pdfSubtotal)]],styles:{fontSize:10,cellPadding:3},columnStyles:{0:{cellWidth:82},1:{halign:"center",cellWidth:20},2:{halign:"right",cellWidth:35},3:{halign:"right",cellWidth:35}}});
    autoTable(doc,{startY:doc.lastAutoTable.finalY+8,theme:"plain",body:[["Subtotal","",currency(pdfSubtotal)],...(includeCcFee?[[`Credit Card Fee ${ccFeePct}%`,"applied",currency(pdfCcFee)]]:[]),[`Tax ${includeTax?`${salesTaxPct}%`:""}`,includeTax?"applied":"Not included",currency(pdfTax)],["Final Total","",currency(pdfTotal)]],styles:{fontSize:10,cellPadding:2},columnStyles:{0:{cellWidth:45,fontStyle:"bold"},1:{cellWidth:85},2:{halign:"right",cellWidth:35}}});
    const tableEndY=doc.lastAutoTable?.finalY||160;
    doc.setFontSize(11); doc.text("Notes",14,tableEndY+14);
    doc.setFontSize(10); doc.text(doc.splitTextToSize(notes||"",180),14,tableEndY+22);
    doc.setFontSize(9); doc.text("Thank you for the opportunity to quote your apparel project.",14,280);
    doc.save(`${slugify(quoteName)}.pdf`);
  };

  const pdfButtonLabel=saveStatus==="saving"?"Saving…":saveStatus==="saved"?"✓ Saved & PDF Generated!":saveStatus==="error"?"Error — retry":"Generate Customer Quote PDF";

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",padding:24,fontFamily:"Inter, Arial, sans-serif",color:"#0f172a"}}>
      <div style={{maxWidth:1400,margin:"0 auto"}}>
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:24}}>
            <div>
              <h1 style={{display:"flex",alignItems:"center",gap:12,margin:0,fontSize:34,color:"#0f172a"}}><Shirt size={32} color="#0f172a"/>TrueMark Quote Tool</h1>
              <p style={{color:"#475569",marginTop:8}}>Fast DTF apparel pricing with live SanMar product data, size-specific pricing, and customer-facing quote output.</p>
            </div>
            <div style={{display:"flex",gap:12}}>
              <button style={buttonStyle} onClick={resetDefaults}><RefreshCcw size={16} style={{marginRight:8,verticalAlign:"middle"}}/>Reset</button>
              <button style={buttonStyle} onClick={()=>setQuotesOpen(true)}><List size={16} style={{marginRight:8,verticalAlign:"middle"}}/>View Quotes</button>
              <button style={buttonStyle} onClick={()=>setOrdersOpen(true)}><ClipboardList size={16} style={{marginRight:8,verticalAlign:"middle"}}/>View Orders</button>
            </div>
          </div>
        </motion.div>

        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:24}}>
          <div style={{display:"grid",gap:24}}>
            <div style={cardStyle}>
              <SectionTitle icon={Calculator}>Quote Builder</SectionTitle>

              {/* Quote Info */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:16}}>
                <Field label="Quote Name"><input style={inputStyle} value={quoteName} onChange={e=>setQuoteName(e.target.value)}/></Field>
                <Field label="Customer"><input style={inputStyle} value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Client / organization"/></Field>
                <Field label="Sales Rep"><input style={inputStyle} value={salesRep} onChange={e=>setSalesRep(e.target.value)}/></Field>
              </div>

              {/* Garment Section */}
              <div style={{background:"#f8fafc",borderRadius:16,padding:16,marginBottom:16,border:"1px solid #e2e8f0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>Garment</div>
                  <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,cursor:"pointer",color:isOneOff?"#7c3aed":"#64748b"}}>
                    <div style={{width:36,height:20,borderRadius:99,background:isOneOff?"#7c3aed":"#cbd5e1",position:"relative",transition:"background 0.2s",cursor:"pointer"}} onClick={()=>{setIsOneOff(!isOneOff);setSelectedStyle(null);setSizeQtys({});setSizePrices({});}}>
                      <div style={{width:16,height:16,borderRadius:"50%",background:"white",position:"absolute",top:2,left:isOneOff?18:2,transition:"left 0.2s"}}/>
                    </div>
                    One-off / custom item
                  </label>
                </div>

                {isOneOff ? (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:12}}>
                      <Field label="Item Name / Description"><input style={inputStyle} value={oneOffName} onChange={e=>setOneOffName(e.target.value)} placeholder="e.g. Comfort Colors 1717 Garment Dye Tee"/></Field>
                      <Field label="Cost / piece"><input style={inputStyle} type="number" step="0.01" value={oneOffCost} onChange={e=>setOneOffCost(e.target.value)} placeholder="0.00"/></Field>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:8}}>Size Breakdown</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:10}}>
                      {Object.keys(oneOffSizes).map(size=>(
                        <Field key={size} label={size}><input style={inputStyle} type="number" min="0" value={oneOffSizes[size]||""} placeholder="0" onChange={e=>setOneOffSizes(prev=>({...prev,[size]:e.target.value}))}/></Field>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Field label="Search SanMar Products">
                      <SanMarSearch onSelect={handleStyleSelect}/>
                    </Field>
                    {selectedStyle && (
                      <div style={{marginTop:10,padding:"8px 12px",background:"white",borderRadius:10,border:"1px solid #e2e8f0",fontSize:13}}>
                        <span style={{fontWeight:700,color:"#0f172a"}}>{selectedStyle.style}</span>
                        <span style={{color:"#475569",marginLeft:8}}>{selectedStyle.product_title}</span>
                        <span style={{color:"#94a3b8",marginLeft:8}}>· {selectedStyle.brand}</span>
                      </div>
                    )}
                    <SanMarColorSizePicker
                      selectedStyle={selectedStyle?.style}
                      onColorSelect={handleColorSelect}
                      onSizeQtyChange={handleSizeQtyChange}
                      sizeQtys={sizeQtys}
                    />
                  </div>
                )}

                <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",fontSize:13}}>
                  <span style={{color:"#64748b"}}>Total quantity</span>
                  <span style={{fontWeight:700,color:"#0f172a"}}>{totalQty}</span>
                </div>
                {!isOneOff && garmentCostEach > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:4}}>
                    <span style={{color:"#64748b"}}>Avg. garment cost / piece</span>
                    <span style={{fontWeight:700,color:"#0f172a"}}>{currency(garmentCostEach)}</span>
                  </div>
                )}
              </div>

              {/* Decoration */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:16}}>
                <Field label="Front Print"><select style={inputStyle} value={frontPrint} onChange={e=>setFrontPrint(e.target.value)}><option value="none">None</option><option value="1">1 Color</option><option value="full">Full Color</option></select></Field>
                <Field label="Back Print"><select style={inputStyle} value={backPrint} onChange={e=>setBackPrint(e.target.value)}><option value="none">None</option><option value="1">1 Color</option><option value="full">Full Color</option></select></Field>
                <div style={{display:"flex",alignItems:"end"}}>
                  <label style={{display:"flex",gap:10,alignItems:"center",fontSize:14,fontWeight:600}}>
                    <input type="checkbox" checked={hasSleevePrint} onChange={e=>setHasSleevePrint(e.target.checked)}/>Additional Sleeve Print
                  </label>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:16}}>
                <Field label="Front Print Cost"><input style={inputStyle} type="number" value={frontPrintCost} onChange={e=>setFrontPrintCost(e.target.value)}/></Field>
                <Field label="Back Print Cost"><input style={inputStyle} type="number" value={backPrintCost} onChange={e=>setBackPrintCost(e.target.value)}/></Field>
                <Field label="Front + Back Combo"><input style={inputStyle} type="number" value={frontBackComboCost} onChange={e=>setFrontBackComboCost(e.target.value)}/></Field>
                <Field label="Sleeve Print Cost"><input style={inputStyle} type="number" value={sleevePrintCost} onChange={e=>setSleevePrintCost(e.target.value)}/></Field>
              </div>

              {/* Fees */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:16,marginBottom:16}}>
                <Field label="Setup Fee"><input style={inputStyle} type="number" value={setupFee} onChange={e=>setSetupFee(e.target.value)}/></Field>
                <Field label="Art Fee"><input style={inputStyle} type="number" value={artFee} onChange={e=>setArtFee(e.target.value)}/></Field>
                <Field label="Shipping Fee"><input style={inputStyle} type="number" value={shippingFee} onChange={e=>setShippingFee(e.target.value)}/></Field>
                <Field label="Rush Fee"><input style={inputStyle} type="number" value={rushFee} onChange={e=>setRushFee(e.target.value)}/></Field>
                <Field label="Packaging / Unit"><input style={inputStyle} type="number" value={packagingFeePerUnit} onChange={e=>setPackagingFeePerUnit(e.target.value)}/></Field>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:16}}>
                <Field label="Overhead %"><input style={inputStyle} type="number" value={overheadPct} onChange={e=>setOverheadPct(e.target.value)}/></Field>
                <Field label="Profit Margin %"><input style={inputStyle} type="number" value={profitMarginPct} onChange={e=>setProfitMarginPct(e.target.value)}/></Field>
                <Field label="Sales Tax %"><input style={inputStyle} type="number" value={salesTaxPct} onChange={e=>setSalesTaxPct(e.target.value)}/></Field>
                <Field label="Credit Card Fee %"><input style={inputStyle} type="number" value={ccFeePct} onChange={e=>setCcFeePct(e.target.value)}/></Field>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:16}}>
                <Field label="Manual Price / Piece"><input style={inputStyle} type="number" step="0.01" placeholder="Optional override" value={manualPriceEach} onChange={e=>setManualPriceEach(e.target.value)}/></Field>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:"flex",gap:10,alignItems:"center",fontSize:14,fontWeight:600}}><input type="checkbox" checked={includeTax} onChange={e=>setIncludeTax(e.target.checked)}/>Include tax in final quote</label>
                <label style={{display:"flex",gap:10,alignItems:"center",fontSize:14,fontWeight:600,marginTop:8}}><input type="checkbox" checked={includeCcFee} onChange={e=>setIncludeCcFee(e.target.checked)}/>Include credit card processing fee</label>
              </div>
              <Field label="Quote Notes"><textarea style={{...inputStyle,minHeight:110,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
            </div>
          </div>

          {/* Right column */}
          <div style={{display:"grid",gap:24,alignSelf:"start"}}>
            <div style={cardStyle}>
              <SectionTitle icon={Package}>Internal Pricing Summary</SectionTitle>
              <div style={{background:"#0f172a",color:"white",borderRadius:20,padding:20,marginBottom:18}}>
                <div style={{color:"#cbd5e1",fontSize:14}}>Sell Price / Piece</div>
                <div style={{fontSize:38,fontWeight:800,marginTop:8}}>{currency(pricePerPiece)}</div>
                <div style={{color:"#cbd5e1",fontSize:14,marginTop:8}}>Total Quote: {currency(displayTotal)}</div>
              </div>
              <SummaryRow label="Quoted quantity" value={String(qty)}/>
              <SummaryRow label="Garment / ea (avg)" value={currency(garmentCostEach)}/>
              <SummaryRow label="DTF / ea" value={currency(decorationCostEach)}/>
              <SummaryRow label="Garment subtotal" value={currency(garmentSubtotal)}/>
              <SummaryRow label="DTF subtotal" value={currency(decorationSubtotal)}/>
              <SummaryRow label="Packaging subtotal" value={currency(packagingSubtotal)}/>
              <SummaryRow label="Fixed fees" value={currency(fixedFees)}/>
              <SummaryRow label="Overhead" value={currency(overhead)}/>
              <SummaryRow label="Profit" value={currency(profit)}/>
              {isManual&&<SummaryRow label="Manual pricing active" value={`${qty} × ${currency(safeNum(manualPriceEach))}`}/>}
              <SummaryRow label={isManual?"Manual subtotal":"Subtotal"} value={currency(isManual?displaySubtotal:subtotal)} bold/>
              <SummaryRow label="Tax" value={currency(isManual?displayTotal-displaySubtotal:tax)}/>
            </div>

            <div style={{...cardStyle,border:"2px solid #0f172a"}}>
              <SectionTitle icon={FileText}>Customer Quote Preview</SectionTitle>
              <div style={{marginBottom:14}}>
                <div style={{textTransform:"uppercase",letterSpacing:1,fontSize:12,color:"#64748b"}}>Quote</div>
                <h3 style={{margin:"6px 0 0",fontSize:28}}>{quoteName}</h3>
                <div style={{marginTop:6,color:"#475569",fontSize:14}}>Prepared for {customerName||"Client"} • Rep: {salesRep}</div>
              </div>
              <div style={{background:"#f8fafc",borderRadius:16,padding:16,fontSize:14,marginBottom:16}}>
                <SummaryRow label="Garment" value={garmentLabel}/>
                <SummaryRow label="Decoration" value="DTF"/>
                <SummaryRow label="Total Quantity" value={String(qty)}/>
                <SummaryRow label="Print Details" value={`Front: ${frontPrint==="full"?"Full Color":frontPrint==="1"?"1 Color":"None"} | Back: ${backPrint==="none"?"None":backPrint==="full"?"Full Color":"1 Color"}${hasSleevePrint?" | Sleeve":""}`}/>
              </div>
              <div style={{background:"#0f172a",color:"white",borderRadius:20,padding:20,marginBottom:16}}>
                <div style={{color:"#cbd5e1",fontSize:14}}>Quoted Price</div>
                <div style={{fontSize:40,fontWeight:800,marginTop:8}}>{currency(pricePerPiece)}</div>
                <div style={{color:"#cbd5e1",fontSize:14}}>per piece</div>
                <div style={{borderTop:"1px solid #334155",marginTop:16,paddingTop:16,fontSize:14,display:"flex",justifyContent:"space-between"}}>
                  <span>Total Project</span><strong>{currency(displayTotal)}</strong>
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontWeight:700,marginBottom:8}}>Notes</div>
                <div style={{color:"#475569",fontSize:14,lineHeight:1.6}}>{notes}</div>
              </div>
              <button
                onClick={async()=>{await saveQuote();generateQuotePdf();}}
                disabled={saveStatus==="saving"}
                style={{width:"100%",padding:"12px 14px",borderRadius:14,border:"none",background:saveStatus==="saved"?"#16a34a":saveStatus==="error"?"#dc2626":"#0f172a",color:"white",fontWeight:700,cursor:"pointer",transition:"background 0.2s"}}
              >{pdfButtonLabel}</button>
            </div>
          </div>
        </div>
      </div>
      <SavedQuotesDrawer open={quotesOpen} onClose={()=>{setQuotesOpen(false);setHighlightQuoteId(null);}} highlightId={highlightQuoteId}/>
      <OrdersDrawer open={ordersOpen} onClose={()=>setOrdersOpen(false)} onViewQuote={quoteId=>{setHighlightQuoteId(quoteId);setOrdersOpen(false);setQuotesOpen(true);}}/>
    </div>
  );
}
