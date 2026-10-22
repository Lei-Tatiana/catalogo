
declare const lucide: { createIcons: () => void };

interface Product {
  id: number;
  name: string;
  category: string;
  categoryId: number;
  price: number;
  stock: number;
}

interface Category {
  id_categoria: number;
  categoria: string;
}


interface ApiProduct {
  id: number;
  nombre: string;
  idCategoria: number;
  categoria: string;
  precio: number;
  stock: number;
}

interface ProductPayload {
  nombre: string;
  idCategoria: number;
  precio: number;
  stock: number;
}

type StockStatus = "En stock" | "Bajo stock" | "Sin stock";
type ViewMode = "table" | "grid";

interface Filters {
  search: string;
  category: string;
  stockStatus: "Todos" | StockStatus;
  maxPrice: number;
}


const MAX_PRICE_DEFAULT = 500000; 

let products: Product[] = [];
let categories: Category[] = [];
let viewMode: ViewMode = "table";
const filters: Filters = {
  search: "",
  category: "",
  stockStatus: "Todos",
  maxPrice: MAX_PRICE_DEFAULT,
};


const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>("product-form");
const inputId = $<HTMLInputElement>("product-id");
const inputName = $<HTMLInputElement>("product-name");
const inputCategory = $<HTMLSelectElement>("product-category"); 
const inputPrice = $<HTMLInputElement>("product-price");
const inputStock = $<HTMLInputElement>("product-stock");
const btnCancel = $<HTMLButtonElement>("btn-cancel");


function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.mensaje ?? "Error del servidor");
  return body as T;
}

async function loadData(): Promise<void> {
  const [cats, prods] = await Promise.all([
    api<Category[]>("/api/categorias"),
    api<ApiProduct[]>("/api/productos"),
  ]);
  categories = cats;
  products = prods.map((p) => ({
    id: p.id,
    name: p.nombre,
    category: p.categoria,
    categoryId: p.idCategoria,
    price: p.precio,
    stock: p.stock,
  }));
}

const addProduct = (data: ProductPayload) =>
  api("/api/productos", { method: "POST", body: JSON.stringify(data) });

const updateProduct = (id: number, data: ProductPayload) =>
  api(`/api/productos/${id}`, { method: "PUT", body: JSON.stringify(data) });

const deleteProduct = (id: number) =>
  api(`/api/productos/${id}`, { method: "DELETE" });


function getStockStatus(stock: number): StockStatus {
  if (stock === 0) return "Sin stock";
  if (stock <= 5) return "Bajo stock";
  return "En stock";
}

function getFilteredProducts(): Product[] {
  const term = filters.search.toLowerCase();
  return products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term);
    const matchCategory = !filters.category || p.category === filters.category;
    const matchStatus =
      filters.stockStatus === "Todos" || getStockStatus(p.stock) === filters.stockStatus;
    const matchPrice = p.price <= filters.maxPrice;
    return matchSearch && matchCategory && matchStatus && matchPrice;
  });
}

function calculateKpis() {
  return {
    total: products.length,
    value: products.reduce((sum, p) => sum + p.price * p.stock, 0),
    stock: products.reduce((sum, p) => sum + p.stock, 0),
    alerts: products.filter((p) => p.stock <= 5).length,
  };
}


function renderKpis(): void {
  const k = calculateKpis();
  $("total-products-kpi").textContent = String(k.total);
  $("total-value-kpi").textContent = `$${k.value.toFixed(2)}`;
  $("total-stock-kpi").textContent = `${k.stock} unids.`;
  $("alert-stock-kpi").textContent = String(k.alerts);
}

function renderCategories(): void {
  const selected = inputCategory.value;
  inputCategory.innerHTML = categories
    .map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.categoria)}</option>`)
    .join("");
  if (selected) inputCategory.value = selected;


  const filterSelect = $<HTMLSelectElement>("filter-category");
  filterSelect.innerHTML =
    `<option value="">Todas las categorías</option>` +
    categories
      .map((c) => `<option value="${escapeHtml(c.categoria)}">${escapeHtml(c.categoria)}</option>`)
      .join("");
  filterSelect.value = filters.category;
}

function renderTable(list: Product[]): void {
  $("product-table-body").innerHTML = list
    .map(
      (p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${getStockStatus(p.stock)}</td>
      <td class="text-right">
        <button data-action="edit" data-id="${p.id}"><i data-lucide="pencil"></i></button>
        <button data-action="delete" data-id="${p.id}"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`
    )
    .join("");
}

function renderGrid(list: Product[]): void {
  $("grid-container").innerHTML = list
    .map(
      (p) => `
    <div class="card">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.category)}</p>
      <p>$${p.price.toFixed(2)} · ${p.stock} unids. · ${getStockStatus(p.stock)}</p>
      <button data-action="edit" data-id="${p.id}"><i data-lucide="pencil"></i></button>
      <button data-action="delete" data-id="${p.id}"><i data-lucide="trash-2"></i></button>
    </div>`
    )
    .join("");
}

function renderProducts(): void {
  const list = getFilteredProducts();
  $("results-count").textContent = `Mostrando ${list.length} productos`;
  $("empty-state").classList.toggle("hidden", list.length > 0);
  $("table-container").classList.toggle("hidden", viewMode !== "table" || list.length === 0);
  $("grid-container").classList.toggle("hidden", viewMode !== "grid" || list.length === 0);

  if (viewMode === "table") renderTable(list);
  else renderGrid(list);

  lucide.createIcons();
}

function render(): void {
  renderKpis();
  renderCategories();
  renderProducts();
}


function startEdit(id: number): void {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  inputId.value = String(p.id); 
  inputName.value = p.name;
  inputCategory.value = String(p.categoryId);
  inputPrice.value = String(p.price);
  inputStock.value = String(p.stock);
  $("form-title").textContent = "Editar Producto";
  $("btn-text").textContent = "Guardar Cambios";
  btnCancel.classList.remove("hidden");
}

function resetForm(): void {
  form.reset();
  inputId.value = "";
  $("form-title").textContent = "Agregar Producto";
  $("btn-text").textContent = "Agregar Producto";
  btnCancel.classList.add("hidden");
}

function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  $("toast-container").appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const data: ProductPayload = {
    nombre: inputName.value.trim(),
    idCategoria: Number(inputCategory.value),
    precio: parseFloat(inputPrice.value),
    stock: parseInt(inputStock.value, 10),
  };

  try {
    if (inputId.value) {
      await updateProduct(Number(inputId.value), data);
      showToast("Producto actualizado");
    } else {
      await addProduct(data);
      showToast("Producto agregado");
    }
    await loadData();
    resetForm();
    render();
  } catch (err) {
    showToast((err as Error).message);
  }
}

async function onTableOrGridClick(e: Event): Promise<void> {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;

  const numericId = Number(id);
  if (action === "edit") startEdit(numericId);
  if (action === "delete" && confirm("¿Eliminar este producto?")) {
    try {
      await deleteProduct(numericId);
      await loadData();
      render();
      showToast("Producto eliminado");
    } catch (err) {
      showToast((err as Error).message);
    }
  }
}

function onFilterChange(): void {
  filters.search = $<HTMLInputElement>("filter-search").value;
  filters.category = $<HTMLSelectElement>("filter-category").value;
  filters.stockStatus = $<HTMLSelectElement>("filter-stock-status").value as Filters["stockStatus"];
  filters.maxPrice = Number($<HTMLInputElement>("filter-max-price").value);
  $("max-price-display").textContent = `$${filters.maxPrice}`;
  renderProducts();
}

function onResetFilters(): void {
  $<HTMLInputElement>("filter-search").value = "";
  $<HTMLSelectElement>("filter-category").value = "";
  $<HTMLSelectElement>("filter-stock-status").value = "Todos";
  $<HTMLInputElement>("filter-max-price").value = String(MAX_PRICE_DEFAULT);
  onFilterChange();
}

function setView(mode: ViewMode): void {
  viewMode = mode;
  $("view-table-btn").classList.toggle("active", mode === "table");
  $("view-grid-btn").classList.toggle("active", mode === "grid");
  renderProducts();
}

async function init(): Promise<void> {
  form.addEventListener("submit", onSubmit);
  btnCancel.addEventListener("click", resetForm);

  $("product-table-body").addEventListener("click", onTableOrGridClick);
  $("grid-container").addEventListener("click", onTableOrGridClick);

  ["filter-search", "filter-category", "filter-stock-status", "filter-max-price"].forEach((id) =>
    $(id).addEventListener("input", onFilterChange)
  );
  $("btn-reset-filters").addEventListener("click", onResetFilters);
  $("view-table-btn").addEventListener("click", () => setView("table"));
  $("view-grid-btn").addEventListener("click", () => setView("grid"));

  try {
    await loadData();
  } catch {
    showToast("No se pudo conectar con el servidor");
  }

  lucide.createIcons();
  render();
  onFilterChange();
}

document.addEventListener("DOMContentLoaded", init);