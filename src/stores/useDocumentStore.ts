import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DocumentKind = "text" | "image";

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Texte extrait pour les documents textuels (vide pour les images) */
  content: string;
  /** Data URL base64 pour les images (modeles vision) */
  dataUrl?: string;
  /** Categorie du document, pour traitement different selon LLM (defaut: "text") */
  kind?: DocumentKind;
  uploadedAt: number;
}

interface DocumentStore {
  documents: Document[];
  addDocument: (document: Omit<Document, "id" | "uploadedAt">) => void;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
  getDocumentContent: (id: string) => string | null;
}

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      documents: [],
      
      addDocument: (document) => {
        const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newDocument: Document = {
          ...document,
          id,
          uploadedAt: Date.now(),
        };
        
        set((state) => ({
          documents: [...state.documents, newDocument],
        }));
      },
      
      removeDocument: (id) => {
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
        }));
      },
      
      clearDocuments: () => set({ documents: [] }),
      
      getDocumentContent: (id) => {
        const { documents } = get();
        const doc = documents.find((d) => d.id === id);
        return doc?.content || null;
      },
    }),
    {
      name: "geoai-document-store",
      partialize: (state) => ({ documents: state.documents }),
    },
  ),
);
