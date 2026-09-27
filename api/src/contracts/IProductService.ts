import type {
  CreateProductBody,
  ListProductsQuery,
  ListProductsResponse,
  ProductDto,
  UpdateProductBody
} from "@mm/lib";

export interface IProductService {
  createProduct: (data: CreateProductBody) => Promise<ProductDto>;
  deleteProduct: (id: string) => Promise<void>;
  getProduct: (id: string) => Promise<ProductDto>;
  listProducts: (query: ListProductsQuery) => Promise<ListProductsResponse>;
  updateProduct: (id: string, data: UpdateProductBody) => Promise<ProductDto>;
}
