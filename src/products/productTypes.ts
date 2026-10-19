import { z } from 'zod';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateProductSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter no mínimo 2 caracteres').max(150, 'O nome deve ter no máximo 150 caracteres'),
  description: z.string().trim().max(2000, 'A descrição deve ter no máximo 2000 caracteres').default(''),
  price: z.number({ invalid_type_error: 'O preço deve ser um número' }).min(0, 'O preço não pode ser negativo'),
  stock: z.number({ invalid_type_error: 'O estoque deve ser um número inteiro' }).int('O estoque deve ser um número inteiro').min(0, 'O estoque não pode ser negativo').default(0),
  category: z.string().trim().min(2, 'A categoria deve ter no mínimo 2 caracteres').max(100, 'A categoria deve ter no máximo 100 caracteres'),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter no mínimo 2 caracteres').max(150, 'O nome deve ter no máximo 150 caracteres').optional(),
  description: z.string().trim().max(2000, 'A descrição deve ter no máximo 2000 caracteres').optional(),
  price: z.number({ invalid_type_error: 'O preço deve ser um número' }).min(0, 'O preço não pode ser negativo').optional(),
  stock: z.number({ invalid_type_error: 'O estoque deve ser um número inteiro' }).int('O estoque deve ser um número inteiro').min(0, 'O estoque não pode ser negativo').optional(),
  category: z.string().trim().min(2, 'A categoria deve ter no mínimo 2 caracteres').max(100, 'A categoria deve ter no máximo 100 caracteres').optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Pelo menos um campo deve ser fornecido para atualização',
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export interface ProductFilterQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
