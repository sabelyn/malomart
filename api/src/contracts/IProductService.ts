import type {
  CreateProductBody,
  ImageUploadDto,
  ImageUploadPostResponse,
  ListProductsQuery,
  ListProductsResponse,
  ProductDto,
  ProductOverview,
  UpdateProductBody
} from "@mm/lib";

export interface IProductService {
  adjustStock: (id: string, change: number) => Promise<ProductDto>;
  createProduct: (data: CreateProductBody) => Promise<ProductDto>;
  deleteProduct: (id: string) => Promise<void>;
  deleteProductImage: (productId: string, imageKey: string) => Promise<ProductDto>;
  getImageUpload: (productId: string, uploadId: string) => Promise<ImageUploadDto>;
  getProduct: (id: string) => Promise<ProductDto>;
  getProductImageUploadPost: (id: string, contentType?: string) => Promise<ImageUploadPostResponse>;
  getProducts: (ids: string[]) => Promise<ProductOverview[]>;
  getProductStocks: (ids: string[]) => Promise<Record<string, number>>;
  listProducts: (query: ListProductsQuery) => Promise<ListProductsResponse>;
  setImageAsThumbnail: (productId: string, imageKey: string) => Promise<ProductDto>;
  updateProduct: (id: string, data: UpdateProductBody) => Promise<ProductDto>;
}
