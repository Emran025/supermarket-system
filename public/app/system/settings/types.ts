
export interface StoreSettings {
    store_name: string;
    store_address: string;
    store_phone: string;
    store_email: string;
    tax_number: string;
    cr_number: string;
  }
  
  export interface InvoiceSettings {
    show_logo: boolean;
    show_qr: boolean;
    footer_text: string;
    terms_text: string;
  }
  
  export interface Session {
    id: number;
    device: string;
    ip_address: string;
    last_activity: string;
    is_current: boolean;
  }
  
  export interface Role {
    id: number;
    name: string;
    description?: string;
    permissions: RolePermission[];
  }
  
  export interface RolePermission {
    module: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }
  
  export interface ModuleData {
    id: number;
    module_key: string;
    name_ar: string;
    name_en: string;
    category: string;
  }
  
