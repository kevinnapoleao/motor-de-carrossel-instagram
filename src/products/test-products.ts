import { ProductService } from './productService.js';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('--- Iniciando Testes Unitários e de Integração da API de Produtos ---');
  const testDb = path.resolve(process.cwd(), 'test-products.sqlite');
  if (fs.existsSync(testDb)) {
    fs.unlinkSync(testDb);
  }

  const service = new ProductService(testDb);

  // 1. Criar Produto
  console.log('1. Testando criação de produto válido...');
  const prod1 = service.createProduct({
    name: 'Teclado Mecânico RGB',
    description: 'Switch Blue, layout ABNT2',
    price: 299.90,
    stock: 15,
    category: 'Periféricos'
  });
  console.log('Produto criado:', prod1.id, prod1.name);
  if (!prod1.id || prod1.price !== 299.90 || prod1.stock !== 15) {
    throw new Error('Falha na criação do produto 1');
  }

  const prod2 = service.createProduct({
    name: 'Mouse Gamer 16000 DPI',
    description: 'Sensor óptico de alta precisão',
    price: 159.50,
    stock: 30,
    category: 'Periféricos'
  });
  console.log('Produto criado:', prod2.id, prod2.name);

  const prod3 = service.createProduct({
    name: 'Monitor UltraWide 29"',
    description: '75Hz IPS Full HD',
    price: 1199.00,
    stock: 5,
    category: 'Monitores'
  });
  console.log('Produto criado:', prod3.id, prod3.name);

  // 2. Testando Validação Zod ao criar com dados inválidos
  console.log('2. Testando rejeição de produto com preço negativo...');
  try {
    service.createProduct({
      name: 'Inválido',
      price: -10,
      stock: 5,
      category: 'Periféricos'
    });
    throw new Error('Deveria ter falhado na validação de preço negativo');
  } catch (err: any) {
    console.log('Sucesso: Validação barrou produto inválido:', err.message);
  }

  // 3. Obter por ID
  console.log('3. Testando busca por ID...');
  const fetched = service.getProductById(prod1.id);
  if (!fetched || fetched.id !== prod1.id) {
    throw new Error('Falha ao buscar produto por ID');
  }
  console.log('Produto recuperado com sucesso:', fetched.name);

  // 4. Listagem e Filtros
  console.log('4. Testando filtros e paginação...');
  const perifs = service.listProducts({ category: 'Periféricos' });
  console.log(`Encontrados ${perifs.total} periféricos (esperado: 2)`);
  if (perifs.total !== 2) throw new Error('Falha no filtro por categoria');

  const searchRes = service.listProducts({ search: 'Gamer' });
  console.log(`Encontrados ${searchRes.total} produtos com busca "Gamer" (esperado: 1)`);
  if (searchRes.total !== 1 || searchRes.items[0].id !== prod2.id) {
    throw new Error('Falha na busca textual');
  }

  const priceFilter = service.listProducts({ minPrice: 200, maxPrice: 500 });
  console.log(`Encontrados ${priceFilter.total} produtos entre R$ 200 e R$ 500 (esperado: 1)`);
  if (priceFilter.total !== 1 || priceFilter.items[0].id !== prod1.id) {
    throw new Error('Falha no filtro por faixa de preço');
  }

  // 5. Atualização
  console.log('5. Testando atualização...');
  const updated = service.updateProduct(prod1.id, {
    price: 269.90,
    stock: 12
  });
  if (!updated || updated.price !== 269.90 || updated.stock !== 12) {
    throw new Error('Falha na atualização do produto');
  }
  console.log('Produto atualizado com sucesso. Novo preço:', updated.price);

  // 6. Deleção
  console.log('6. Testando deleção...');
  const deleted = service.deleteProduct(prod3.id);
  if (!deleted) throw new Error('Falha ao deletar produto');
  const afterDelete = service.getProductById(prod3.id);
  if (afterDelete !== null) throw new Error('Produto ainda existe após deleção');
  console.log('Produto deletado com sucesso.');

  // Close database connection before cleanup
  service.close();

  // Cleanup test DB
  if (fs.existsSync(testDb)) {
    fs.unlinkSync(testDb);
  }

  console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
}

runTests().catch(err => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
