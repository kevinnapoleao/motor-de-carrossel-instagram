/**
 * PRODUCTS CLIENT CONTROLLER
 * Consome a API RESTful de Produtos (/api/products)
 * Suporta Listagem, Busca debounceada, Filtros por Categoria/Status, Ordenação, Paginação, Modal de Criação/Edição e Exclusão.
 */

const state = {
  products: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  search: '',
  category: '',
  statusFilter: '', // 'in_stock', 'low_stock', 'out_of_stock'
  sortBy: 'createdAt',
  sortOrder: 'desc',
  categoriesList: [],
  editingProduct: null,
  deletingProductId: null,
  isLoading: false,
};

// Utilitários de DOM
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));
};

const formatDate = (isoStr) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return isoStr;
  }
};

// Utilitário de Notificações Toast
function toast(message, type = 'success', duration = 4000) {
  const host = $('#toast-stack');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// Fetch helper com tratamento de erros amigável
async function fetchApi(endpoint, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
  };
  if (options.body && typeof options.body === 'object') {
    defaultHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || `Erro de comunicação com o servidor (${response.status}).`);
    err.issues = data.issues;
    throw err;
  }

  return data;
}

// Determina status de estoque visual
function getStockStatus(stock) {
  const num = Number(stock || 0);
  if (num <= 0) {
    return { key: 'out_of_stock', label: 'Esgotado', class: 'out-of-stock' };
  }
  if (num <= 5) {
    return { key: 'low_stock', label: `Baixo (${num})`, class: 'low-stock' };
  }
  return { key: 'in_stock', label: `Em Estoque (${num})`, class: 'in-stock' };
}

// Atualiza Métricas do Topo
function updateMetricsCards(allProducts = []) {
  const total = allProducts.length;
  let totalStockVal = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  allProducts.forEach(p => {
    const stock = Number(p.stock || 0);
    const price = Number(p.price || 0);
    totalStockVal += (stock * price);
    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= 5) {
      lowStockCount++;
    }
  });

  $('#stat-total-products').textContent = String(total);
  $('#stat-total-value').textContent = formatCurrency(totalStockVal);
  $('#stat-low-stock').textContent = String(lowStockCount);
  $('#stat-out-of-stock').textContent = String(outOfStockCount);
}

// Carregar Categorias Únicas
async function loadCategories() {
  try {
    const res = await fetchApi('/api/products?limit=1000');
    if (res.products && Array.isArray(res.products)) {
      const categories = [...new Set(res.products.map(p => p.category?.trim()).filter(Boolean))].sort();
      state.categoriesList = categories;

      // Popula Select de Filtro
      const filterSelect = $('#category-filter');
      const currentSelected = filterSelect.value;
      filterSelect.innerHTML = '<option value="">Todas as categorias</option>' + 
        categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      filterSelect.value = currentSelected;

      // Popula Datalist para autocomplete no modal
      const dataList = $('#category-suggestions');
      if (dataList) {
        dataList.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');
      }

      // Atualiza métricas baseadas na base total
      updateMetricsCards(res.products);
    }
  } catch (err) {
    console.warn('[Products] Não foi possível carregar categorias auxiliares:', err);
  }
}

// Renderiza a Lista de Produtos na Tabela
function renderProductsTable() {
  const tbody = $('#products-tbody');
  const emptyState = $('#empty-state');
  const tableWrap = $('#products-table-wrap');
  const footer = $('#table-footer');

  if (state.products.length === 0) {
    tbody.innerHTML = '';
    tableWrap.hidden = true;
    footer.hidden = true;
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  tableWrap.hidden = false;
  footer.hidden = false;

  tbody.innerHTML = state.products.map(product => {
    const status = getStockStatus(product.stock);
    return `
      <tr data-id="${escapeHtml(product.id)}">
        <td>
          <div class="prod-primary">
            <span class="prod-name">${escapeHtml(product.name)}</span>
            ${product.description ? `<span class="prod-desc" title="${escapeHtml(product.description)}">${escapeHtml(product.description)}</span>` : '<span class="prod-desc" style="color:#aaa;">Sem descrição informada</span>'}
          </div>
        </td>
        <td>
          <span class="category-tag">${escapeHtml(product.category)}</span>
        </td>
        <td>
          <span class="prod-price">${formatCurrency(product.price)}</span>
        </td>
        <td>
          <span class="prod-stock-count">${product.stock} un</span>
        </td>
        <td>
          <span class="stock-status-badge ${status.class}">
            <i></i> ${status.label}
          </span>
        </td>
        <td>
          <span class="prod-date">${formatDate(product.createdAt)}</span>
        </td>
        <td class="text-right">
          <div class="action-buttons-wrap">
            <button class="action-icon-btn edit-action" data-action="edit" data-id="${escapeHtml(product.id)}" title="Editar produto">
              ✏️
            </button>
            <button class="action-icon-btn delete-action" data-action="delete" data-id="${escapeHtml(product.id)}" title="Excluir produto">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Atualiza controles de paginação
  renderPagination();
}

// Renderiza Controles de Paginação
function renderPagination() {
  const startItem = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
  const endItem = Math.min(state.page * state.limit, state.total);
  $('#pagination-info').textContent = `Mostrando ${startItem}–${endItem} de ${state.total} produtos`;
  $('#products-counter').textContent = `${state.total} produtos`;

  const prevBtn = $('#prev-page-btn');
  const nextBtn = $('#next-page-btn');
  const pagesContainer = $('#pagination-pages');

  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= state.totalPages;

  // Botões de número de página
  pagesContainer.innerHTML = '';
  for (let i = 1; i <= state.totalPages; i++) {
    // Exibe até 5 páginas ou páginas próximas
    if (i === 1 || i === state.totalPages || (i >= state.page - 1 && i <= state.page + 1)) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-num-btn ${i === state.page ? 'active' : ''}`;
      pageBtn.textContent = String(i);
      pageBtn.addEventListener('click', () => {
        if (state.page !== i) {
          state.page = i;
          loadProducts();
        }
      });
      pagesContainer.appendChild(pageBtn);
    } else if (
      (i === state.page - 2 && i > 1) || 
      (i === state.page + 2 && i < state.totalPages)
    ) {
      const ellipsis = document.createElement('span');
      ellipsis.style.padding = '0 3px';
      ellipsis.style.color = '#888';
      ellipsis.textContent = '…';
      pagesContainer.appendChild(ellipsis);
    }
  }
}

// Carregar Produtos da API com Filtros Ativos
async function loadProducts() {
  if (state.isLoading) return;
  state.isLoading = true;

  const loadingState = $('#loading-state');
  const errorState = $('#error-state');
  const tableWrap = $('#products-table-wrap');
  const emptyState = $('#empty-state');
  const footer = $('#table-footer');

  loadingState.hidden = false;
  errorState.hidden = true;

  try {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));

    if (state.search.trim()) {
      params.set('search', state.search.trim());
    }

    if (state.category) {
      params.set('category', state.category);
    }

    if (state.sortBy) {
      params.set('sortBy', state.sortBy);
      params.set('sortOrder', state.sortOrder);
    }

    const data = await fetchApi(`/api/products?${params.toString()}`);
    let productsList = data.products || [];

    // Filtro adicional no cliente para status de estoque se selecionado
    if (state.statusFilter) {
      productsList = productsList.filter(p => {
        const status = getStockStatus(p.stock);
        return status.key === state.statusFilter;
      });
    }

    state.products = productsList;
    state.total = data.total ?? productsList.length;
    state.totalPages = data.totalPages ?? Math.max(1, Math.ceil(state.total / state.limit));

    renderProductsTable();
  } catch (err) {
    console.error('[Products Error]', err);
    tableWrap.hidden = true;
    emptyState.hidden = true;
    footer.hidden = true;
    errorState.hidden = false;
    $('#error-message').textContent = err.message || 'Falha ao conectar com o serviço de produtos.';
  } finally {
    loadingState.hidden = true;
    state.isLoading = false;
  }
}

// Abertura do Modal de Criação / Edição
function openProductModal(product = null) {
  state.editingProduct = product;
  const modal = $('#product-modal');
  const form = $('#product-form');
  const title = $('#modal-title');
  const eyebrow = $('#modal-eyebrow');
  const subtitle = $('#modal-subtitle');
  const submitBtn = $('#modal-submit-btn');
  const alertBox = $('#modal-alert');

  // Limpa erros anteriores
  alertBox.hidden = true;
  alertBox.textContent = '';
  $$('.field-error').forEach(el => el.textContent = '');
  $$('.has-error').forEach(el => el.classList.remove('has-error'));

  form.reset();

  if (product) {
    eyebrow.textContent = 'EDITAR ITEM';
    title.textContent = 'Editar Produto';
    subtitle.textContent = `Atualize os dados e estoque de "${product.name}".`;
    submitBtn.querySelector('span').textContent = 'Salvar Alterações';

    $('#product-id').value = product.id;
    $('#field-name').value = product.name;
    $('#field-category').value = product.category;
    $('#field-price').value = product.price;
    $('#field-stock').value = product.stock;
    $('#field-description').value = product.description || '';
  } else {
    eyebrow.textContent = 'NOVO ITEM';
    title.textContent = 'Adicionar Produto';
    subtitle.textContent = 'Preencha os dados abaixo para cadastrar o produto no catálogo local.';
    submitBtn.querySelector('span').textContent = 'Cadastrar Produto';
    $('#product-id').value = '';
  }

  modal.showModal();
}

function closeProductModal() {
  const modal = $('#product-modal');
  modal.close();
  state.editingProduct = null;
}

// Salvar / Submeter Formulário de Produto
async function handleProductFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = $('#modal-submit-btn');
  const alertBox = $('#modal-alert');

  // Validação básica frontend
  alertBox.hidden = true;
  $$('.field-error').forEach(el => el.textContent = '');
  $$('.has-error').forEach(el => el.classList.remove('has-error'));

  const name = $('#field-name').value.trim();
  const category = $('#field-category').value.trim();
  const priceVal = parseFloat($('#field-price').value);
  const stockVal = parseInt($('#field-stock').value, 10);
  const description = $('#field-description').value.trim();

  let hasError = false;
  if (!name || name.length < 2) {
    $('#error-field-name').textContent = 'O nome deve ter no mínimo 2 caracteres.';
    $('#field-name').classList.add('has-error');
    hasError = true;
  }
  if (!category || category.length < 2) {
    $('#error-field-category').textContent = 'A categoria deve ter no mínimo 2 caracteres.';
    $('#field-category').classList.add('has-error');
    hasError = true;
  }
  if (isNaN(priceVal) || priceVal < 0) {
    $('#error-field-price').textContent = 'O preço deve ser um número positivo.';
    $('#field-price').classList.add('has-error');
    hasError = true;
  }
  if (isNaN(stockVal) || stockVal < 0) {
    $('#error-field-stock').textContent = 'O estoque deve ser um número inteiro maior ou igual a zero.';
    $('#field-stock').classList.add('has-error');
    hasError = true;
  }

  if (hasError) return;

  const payload = {
    name,
    category,
    price: priceVal,
    stock: stockVal,
    description,
  };

  const isEditing = Boolean(state.editingProduct && state.editingProduct.id);
  const endpoint = isEditing ? `/api/products/${state.editingProduct.id}` : '/api/products';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Salvando...';

    const res = await fetchApi(endpoint, {
      method,
      body: payload,
    });

    toast(isEditing ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!', 'success');
    closeProductModal();
    await Promise.all([loadProducts(), loadCategories()]);
  } catch (err) {
    console.error('[Save Product Error]', err);
    alertBox.textContent = err.message || 'Falha ao salvar produto. Verifique os campos informados.';
    alertBox.hidden = false;

    if (err.issues && Array.isArray(err.issues)) {
      err.issues.forEach(issue => {
        const fieldEl = $(`#field-${issue.field}`);
        const errorEl = $(`#error-field-${issue.field}`);
        if (fieldEl) fieldEl.classList.add('has-error');
        if (errorEl) errorEl.textContent = issue.message;
      });
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>${isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}</span> <span class="button-arrow">↗</span>`;
  }
}

// Confirmação e Ação de Exclusão
function openDeleteModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.deletingProductId = productId;
  $('#delete-product-name').textContent = `"${product.name}"`;
  const modal = $('#delete-modal');
  modal.showModal();
}

function closeDeleteModal() {
  const modal = $('#delete-modal');
  modal.close();
  state.deletingProductId = null;
}

async function confirmDeleteProduct() {
  if (!state.deletingProductId) return;

  const deleteBtn = $('#delete-confirm-btn');
  try {
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner"></span> Excluindo...';

    await fetchApi(`/api/products/${state.deletingProductId}`, {
      method: 'DELETE',
    });

    toast('Produto excluído com sucesso.', 'success');
    closeDeleteModal();

    // Se era o único item da página e não é a página 1, volta uma página
    if (state.products.length === 1 && state.page > 1) {
      state.page--;
    }

    await Promise.all([loadProducts(), loadCategories()]);
  } catch (err) {
    toast(err.message || 'Erro ao tentar excluir produto.', 'error');
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.innerHTML = '<span>Excluir Definitivamente</span>';
  }
}

// Vinculação de Eventos e Listeners
function bindEvents() {
  // Botão Novo Produto
  $('#open-create-modal-btn').addEventListener('click', () => openProductModal());
  $('#empty-create-btn').addEventListener('click', () => openProductModal());

  // Fechar Modal de Produto
  $('#modal-close-x-btn').addEventListener('click', closeProductModal);
  $('#modal-cancel-btn').addEventListener('click', closeProductModal);

  // Submissão do Form
  $('#product-form').addEventListener('submit', handleProductFormSubmit);

  // Exclusão
  $('#delete-cancel-btn').addEventListener('click', closeDeleteModal);
  $('#delete-confirm-btn').addEventListener('click', confirmDeleteProduct);

  // Ações de linha na tabela (Delegação de Eventos)
  $('#products-tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="edit"]');
    const deleteBtn = e.target.closest('[data-action="delete"]');

    if (editBtn) {
      const id = editBtn.dataset.id;
      const product = state.products.find(p => p.id === id);
      if (product) openProductModal(product);
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      openDeleteModal(id);
    }
  });

  // Busca com Debounce
  let searchTimeout = null;
  const searchInput = $('#search-input');
  const clearSearchBtn = $('#clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.hidden = !val;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = val;
      state.page = 1;
      loadProducts();
    }, 350);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    state.search = '';
    state.page = 1;
    loadProducts();
  });

  // Filtro por Categoria
  $('#category-filter').addEventListener('change', (e) => {
    state.category = e.target.value;
    state.page = 1;
    loadProducts();
  });

  // Filtro por Status de Estoque
  $('#status-filter').addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    state.page = 1;
    loadProducts();
  });

  // Ordenação
  $('#sort-by').addEventListener('change', (e) => {
    const [field, order] = e.target.value.split('-');
    state.sortBy = field;
    state.sortOrder = order;
    state.page = 1;
    loadProducts();
  });

  // Paginação
  $('#prev-page-btn').addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      loadProducts();
    }
  });

  $('#next-page-btn').addEventListener('click', () => {
    if (state.page < state.totalPages) {
      state.page++;
      loadProducts();
    }
  });

  // Botão Atualizar do Topo
  $('#refresh-products-btn').addEventListener('click', () => {
    toast('Atualizando lista de produtos...', 'info', 1500);
    loadCategories();
    loadProducts();
  });

  // Botão Tentar Novamente (caso de erro)
  $('#retry-fetch-btn').addEventListener('click', () => {
    loadProducts();
  });
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await Promise.all([loadCategories(), loadProducts()]);
});
