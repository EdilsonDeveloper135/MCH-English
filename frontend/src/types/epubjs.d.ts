declare module "epubjs" {
  export interface BookMetadata {
    title?: string;
    creator?: string;
    description?: string;
    language?: string;
  }

  export interface SpineItem {
    idref: string;
    href: string;
    load: (load: unknown) => Promise<Document | string>;
    unload?: () => void;
  }

  export interface Spine {
    items: SpineItem[];
    spineItems: SpineItem[];
    each: (fn: (item: SpineItem) => void) => void;
  }

  export interface Book {
    ready: Promise<void>;
    loaded: {
      metadata: Promise<BookMetadata>;
      spine: Promise<Spine>;
    };
    spine: Spine;
    load: (path: string) => Promise<unknown>;
    destroy?: () => void;
  }

  export default function ePub(options?: unknown): Book;
  export default function ePub(url: string | ArrayBuffer, options?: unknown): Book;
}
