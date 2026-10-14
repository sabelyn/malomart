import type {
  CreateProductBody,
  ListProductsQuery,
  ListProductsResponse,
  PresignedPostResponse,
  ProductDto,
  ProductOverview,
  UpdateProductBody
} from "@mm/lib";

export interface IProductService {
  createProduct: (data: CreateProductBody) => Promise<ProductDto>;
  deleteProduct: (id: string) => Promise<void>;
  deleteProductImage: (productId: string, imageKey: string) => Promise<ProductDto>;
  getProduct: (id: string) => Promise<ProductDto>;
  getProductImageUploadPost: (id: string, contentType?: string) => Promise<PresignedPostResponse>;
  getProducts: (ids: string[]) => Promise<ProductOverview[]>;
  getProductStocks: (ids: string[]) => Promise<Record<string, number>>;
  listProducts: (query: ListProductsQuery) => Promise<ListProductsResponse>;
  setImageAsThumbnail: (productId: string, imageKey: string) => Promise<ProductDto>;
  updateProduct: (id: string, data: UpdateProductBody) => Promise<ProductDto>;
}
