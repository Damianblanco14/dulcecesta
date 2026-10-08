const cfg = window.DULCECESTA_CONFIG || {};
const DEMO = !cfg.supabaseUrl || !cfg.supabaseKey;
const supabase = DEMO ? null : window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

const demoProducts = [
  {id:"d1",name:"Caramelos surtidos",price:5,stock:25,emoji:"🍬",image_url:null,active:true},
  {id:"d2",name:"Galletas de chocolate",price:3.5,stock:12,emoji:"🍪",image_url:null,active:true},
  {id:"d3",name:"Gomitas frutales",price:4,stock:20,emoji:"🍭",image_url:null,active:true},
  {id:"d4",name:"Bombones",price:6,stock:18,emoji:"🍫",image_url:null,active:true},
  {id:"d5",name:"Nubes de azúcar",price:3,stock:15,emoji:"☁️",image_url:null,active:true},
  {id:"d6",name:"Paletas de colores",price:2.5,stock:14,emoji:"🍭",image_url:null,active:true},
  {id:"d7",name:"Caja dulce sorpresa",price:12,stock:8,emoji:"🎁",image_url:null,active:true},
  {id:"d8",name:"Mini cesta regalo",price:15,stock:15,emoji:"🧺",image_url:null,active:true}
];

let products = [];
let cart = JSON.parse(localStorage.getItem("dulcecesta_cart") || "[]");
let ordersDemo = JSON.parse(localStorage.getItem("dulcecesta_orders") || "[]");
let currentUser = null;

const $ = id => document.getElementById(id);
const money = n => `$${Number(n).toFixed(2)}`;

function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2200);
}
function saveCart(){ localStorage.setItem("dulcecesta_cart",JSON.stringify(cart)); renderCart(); }
function openEl(id){$(id).classList.remove("hidden")}
function closeEl(id){$(id).classList.add("hidden")}

async function loadProducts(){
  if(DEMO){ products=[...demoProducts]; }
  else {
    const {data,error}=await supabase.from("products").select("*").eq("active",true).order("name");
    if(error){ $("status").textContent="No se pudo cargar el catálogo: "+error.message; return; }
    products=data||[];
  }
  renderProducts();
}

function renderProducts(){
  const q=($("search").value||"").toLowerCase().trim();
  const list=products.filter(p=>p.name.toLowerCase().includes(q));
  $("products").innerHTML=list.map(p=>{
    const out=p.stock<=0;
    const pic=p.image_url ? `<img src="${escapeAttr(p.image_url)}" alt="">` : `<span>${escapeHtml(p.emoji||"🍬")}</span>`;
    return `<article class="card">
      <div class="pic">${pic}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <p class="price">${money(p.price)}</p>
      <p class="stock">${out?"Agotado":`${p.stock} disponibles`}</p>
      <button ${out?"disabled":""} onclick="addToCart('${p.id}')">${out?"Agotado":"Añadir al carrito"}</button>
    </article>`;
  }).join("") || `<p>No encontramos productos con esa búsqueda.</p>`;
}

window.addToCart = function(id){
  const p=products.find(x=>String(x.id)===String(id)); if(!p) return;
  const item=cart.find(x=>String(x.id)===String(id));
  if(item){ if(item.qty>=p.stock){toast("No hay más unidades disponibles");return} item.qty++; }
  else cart.push({id:p.id,name:p.name,price:p.price,qty:1});
  saveCart(); toast("Añadido al carrito");
};

function renderCart(){
  $("cartCount").textContent=cart.reduce((s,x)=>s+x.qty,0);
  $("cartItems").innerHTML=cart.length?cart.map((x,i)=>`
    <div class="cart-row"><div><b>${escapeHtml(x.name)}</b><br>${money(x.price)} c/u</div>
      <div class="qty"><button onclick="changeQty(${i},-1)">−</button> ${x.qty} <button onclick="changeQty(${i},1)">+</button></div>
      <b>${money(x.price*x.qty)}</b></div>`).join(""):`<p class="muted">Tu carrito está vacío.</p>`;
  $("cartTotal").textContent=money(cart.reduce((s,x)=>s+x.price*x.qty,0));
}
window.changeQty=function(i,d){
  const p=products.find(x=>String(x.id)===String(cart[i].id));
  cart[i].qty+=d;
  if(p && cart[i].qty>p.stock) cart[i].qty=p.stock;
  if(cart[i].qty<=0) cart.splice(i,1);
  saveCart();
};

async function sendOrder(){
  if(!cart.length){toast("El carrito está vacío");return}
  const customer={name:$("customerName").value.trim(),phone:$("customerPhone").value.trim(),address:$("customerAddress").value.trim(),note:$("customerNote").value.trim()};
  if(!customer.name||!customer.phone){$("orderMsg").textContent="Completa nombre y teléfono.";return}
  $("sendOrderBtn").disabled=true;
  try{
    if(DEMO){
      const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
      const order={id:"DEMO-"+Date.now().toString().slice(-6),created_at:new Date().toISOString(),...customer,total,items:cart.map(x=>({...x})) ,status:"Pendiente"};
      ordersDemo.unshift(order); localStorage.setItem("dulcecesta_orders",JSON.stringify(ordersDemo));
      cart=[]; saveCart(); closeEl("checkoutOverlay"); toast("Pedido creado (modo demo)");
    }else{
      const payload={customer_name:customer.name,customer_phone:customer.phone,delivery_address:customer.address,customer_note:customer.note,items:cart.map(x=>({product_id:x.id,quantity:x.qty}))};
      const {data,error}=await supabase.rpc("create_order", {p_order:payload});
      if(error) throw error;
      cart=[]; saveCart(); closeEl("checkoutOverlay"); toast("Pedido enviado correctamente");
    }
  }catch(e){$("orderMsg").textContent="No se pudo enviar: "+e.message}
  finally{$("sendOrderBtn").disabled=false}
}

async function openAdmin(){
  if(DEMO){ currentUser={email:"demo@dulcecesta.local"}; openEl("adminOverlay"); await renderAdmin(); return; }
  const {data}=await supabase.auth.getUser();
  if(data.user){currentUser=data.user; openEl("adminOverlay"); await renderAdmin();}
  else openEl("adminLoginOverlay");
}
async function login(){
  $("loginMsg").textContent="";
  const email=$("adminEmail").value.trim(), password=$("adminPassword").value;
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error){$("loginMsg").textContent=error.message;return}
  currentUser=data.user; closeEl("adminLoginOverlay"); openEl("adminOverlay"); await renderAdmin();
}
async function logout(){
  if(!DEMO) await supabase.auth.signOut();
  currentUser=null; closeEl("adminOverlay"); toast("Sesión cerrada");
}

async function renderAdmin(){
  $("adminUser").textContent=currentUser?.email||"Modo demo";
  await renderInventory(); await renderOrders();
}
async function getAllProducts(){
  if(DEMO)return products;
  const {data,error}=await supabase.from("products").select("*").order("name");
  if(error){toast(error.message);return []} return data||[];
}
async function renderInventory(){
  const list=await getAllProducts(); products=DEMO?products:list;
  const units=list.reduce((s,p)=>s+Number(p.stock||0),0), low=list.filter(p=>p.stock<=5).length;
  $("stats").innerHTML=`<div class="stat"><b>${list.length}</b>Productos</div><div class="stat"><b>${units}</b>Unidades</div><div class="stat"><b>${low}</b>Poco stock</div><div class="stat"><b>${DEMO?ordersDemo.length:"…"}</b>Pedidos</div>`;
  $("inventoryList").innerHTML=list.map(p=>`
    <div class="inventory-item">
      <div class="mini">${p.image_url?`<img src="${escapeAttr(p.image_url)}" alt="">`:escapeHtml(p.emoji||"🍬")}</div>
      <div><b>${escapeHtml(p.name)}</b><br><span>${money(p.price)} · stock ${p.stock}</span></div>
      <div class="stock-actions"><button onclick="changeStock('${p.id}',-1)">−</button><b>${p.stock}</b><button onclick="changeStock('${p.id}',1)">+</button><button onclick="deleteProduct('${p.id}')">🗑️</button></div>
    </div>`).join("");
}
window.changeStock=async function(id,delta){
  const p=(await getAllProducts()).find(x=>String(x.id)===String(id)); if(!p)return;
  const next=Math.max(0,Number(p.stock)+delta);
  if(DEMO){p.stock=next;products.find(x=>x.id===id).stock=next;renderProducts();renderInventory();return}
  const {error}=await supabase.from("products").update({stock:next}).eq("id",id);
  if(error)toast(error.message); else {await loadProducts();await renderInventory()}
};
window.deleteProduct=async function(id){
  if(!confirm("¿Eliminar este producto?"))return;
  if(DEMO){products=products.filter(p=>String(p.id)!==String(id));renderProducts();renderInventory();return}
  const {error}=await supabase.from("products").delete().eq("id",id);
  if(error)toast(error.message); else {await loadProducts();await renderInventory()}
};

async function addProduct(){
  const name=$("pName").value.trim(), price=Number($("pPrice").value), stock=Number($("pStock").value), emoji=$("pEmoji").value.trim()||"🍬", file=$("pImage").files[0];
  if(!name||price<0||stock<0){toast("Completa nombre, precio y stock");return}
  if(DEMO){
    const p={id:"d"+Date.now(),name,price,stock,emoji,image_url:null,active:true}; products.push(p); renderProducts(); renderInventory(); toast("Producto añadido en demo"); return;
  }
  let image_url=null;
  try{
    if(file){
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${crypto.randomUUID()}.${ext}`;
      const {error:upErr}=await supabase.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
      if(upErr) throw upErr;
      image_url=supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await supabase.from("products").insert({name,price,stock,emoji,image_url,active:true});
    if(error)throw error;
    ["pName","pPrice","pStock","pEmoji"].forEach(id=>$(id).value=id==="pEmoji"?"🍬":"");
    $("pImage").value="";
    await loadProducts(); await renderInventory(); toast("Producto añadido");
  }catch(e){toast(e.message)}
};

async function renderOrders(){
  if(DEMO){
    $("ordersList").innerHTML=ordersDemo.length?ordersDemo.map(orderCard).join(""):`<p class="muted">No hay pedidos.</p>`;
    return;
  }
  const {data,error}=await supabase.from("orders").select("*, order_items(*, products(name))").order("created_at",{ascending:false});
  if(error){$("ordersList").textContent=error.message;return}
  $("ordersList").innerHTML=data?.length?data.map(o=>orderCard(o)).join(""):`<p class="muted">No hay pedidos.</p>`;
}
function orderCard(o){
  const items=o.items||o.order_items||[];
  const lines=items.map(i=>`<li>${i.quantity} × ${escapeHtml(i.name||i.products?.name||"Producto")}</li>`).join("");
  return `<article class="order"><div class="order-head"><div><h3>Pedido #${escapeHtml(String(o.id).slice(-6))}</h3><small>${new Date(o.created_at).toLocaleString()} · ${escapeHtml(o.customer_name||o.name||"") } · ${escapeHtml(o.customer_phone||o.phone||"")}</small></div>
  <select onchange="updateOrderStatus('${o.id}',this.value)">${["Pendiente","Preparando","Entregado","Cancelado"].map(s=>`<option ${s===(o.status||"Pendiente")?"selected":""}>${s}</option>`).join("")}</select></div>
  <ul>${lines}</ul><small>📍 ${escapeHtml(o.delivery_address||o.address||"Sin dirección")} ${o.customer_note||o.note?`· ${escapeHtml(o.customer_note||o.note)}`:""}</small><div class="cart-total">Total <strong>${money(o.total)}</strong></div></article>`;
}
window.updateOrderStatus=async function(id,status){
  if(DEMO){const o=ordersDemo.find(x=>String(x.id)===String(id));if(o){o.status=status;localStorage.setItem("dulcecesta_orders",JSON.stringify(ordersDemo));toast("Estado actualizado")};return}
  const {error}=await supabase.from("orders").update({status}).eq("id",id);
  if(error)toast(error.message);else toast("Estado actualizado");
};

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(v){return escapeHtml(v)}

$("search").addEventListener("input",renderProducts);
$("cartBtn").onclick=()=>{renderCart();openEl("cartOverlay")};
$("adminBtn").onclick=openAdmin;
$("checkoutBtn").onclick=()=>{if(!cart.length){toast("El carrito está vacío");return}closeEl("cartOverlay");openEl("checkoutOverlay")};
$("sendOrderBtn").onclick=sendOrder;
$("loginBtn").onclick=login;
$("logoutBtn").onclick=logout;
$("addProductBtn").onclick=addProduct;
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const m=b.dataset.close;closeEl(m==="cart"?"cartOverlay":m==="checkout"?"checkoutOverlay":m==="login"?"adminLoginOverlay":"adminOverlay")});
document.querySelectorAll(".tab").forEach(t=>t.onclick=async()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");const inv=t.dataset.tab==="inventory";$("inventoryTab").classList.toggle("hidden",!inv);$("ordersTab").classList.toggle("hidden",inv);if(!inv)await renderOrders()});
if(!DEMO){supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null})}
loadProducts();renderCart();
