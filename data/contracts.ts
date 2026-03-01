// ===== DOMAIN DATA CONTRACT LAYER =====
// Every table declares: ownerDomain, primaryKeyFields, writableFields, foreignKeyContracts

export type DomainKey = 
  | "project-management" 
  | "engineering" 
  | "client-support" 
  | "purchasing" 
  | "warehouse" 
  | "site-management";

export interface ForeignKeyContract {
  field: string;
  referencesTable: string;
  referencesDomain: DomainKey;
  referencesKey: string;
  access: "read-only";
}

export interface TableContract {
  tableName: string;
  ownerDomain: DomainKey;
  primaryKeyFields: string[];
  /** Canonical key formula (if composite) */
  canonicalKeyFormula?: string;
  writableFields: string[];
  foreignKeyContracts: ForeignKeyContract[];
  description: string;
}

export interface HandoffContract {
  id: string;
  name: string;
  fromDomain: DomainKey;
  toDomain: DomainKey;
  headerTable: string;
  lineTable: string;
  triggerCondition: string;
  payloadFields: string[];
}

// ===== CANONICAL KEY BUILDERS =====

export const canonicalKeys = {
  project: (projectNumber: string) => projectNumber,
  asset: (projectNumber: string, assetIdNumber: string) => `${projectNumber}-${assetIdNumber}`,
  drawing: (projectNumber: string, drawingNumber: string) => `${projectNumber}-${drawingNumber}`,
  bomPart: (revision: string, projectNumber: string, assetId: string, bomGroup: string, itemNumber: number) =>
    `${revision}|${projectNumber}|${assetId}|${bomGroup}|${itemNumber}`,
  partMaster: (partNumber: string) => partNumber,
  vendor: (sageVendorId: string) => sageVendorId,
  vendorPart: (sageVendorId: string, vendorPartNumber: string) => `${sageVendorId}|${vendorPartNumber}`,
} as const;

// ===== TABLE CONTRACT REGISTRY =====

export const tableContracts: TableContract[] = [
  // --- Project Management ---
  {
    tableName: "Projects",
    ownerDomain: "project-management",
    primaryKeyFields: ["projectNumber"],
    canonicalKeyFormula: "projectNumber",
    writableFields: ["name", "client", "status", "phase", "progress", "pm"],
    foreignKeyContracts: [],
    description: "Master project registry. All other entities reference projectNumber.",
  },
  {
    tableName: "Project Resources",
    ownerDomain: "project-management",
    primaryKeyFields: ["projectNumber", "name"],
    writableFields: ["role", "allocation"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Personnel allocated to projects.",
  },

  // --- Engineering ---
  {
    tableName: "Assets",
    ownerDomain: "engineering",
    primaryKeyFields: ["assetUID"],
    canonicalKeyFormula: "projectNumber + '-' + assetIdNumber",
    writableFields: ["tag", "description", "type", "status", "drawingUID"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
      { field: "drawingUID", referencesTable: "Drawings", referencesDomain: "engineering", referencesKey: "drawingUID", access: "read-only" },
    ],
    description: "Physical equipment/assets linked to projects and drawings.",
  },
  {
    tableName: "Drawings",
    ownerDomain: "engineering",
    primaryKeyFields: ["drawingUID"],
    canonicalKeyFormula: "projectNumber + '-' + drawingNumber",
    writableFields: ["title", "rev", "status"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Engineering drawings. One drawing may contain multiple assets.",
  },
  {
    tableName: "BOM Parts",
    ownerDomain: "engineering",
    primaryKeyFields: ["trackingAddress"],
    canonicalKeyFormula: "revision + '|' + projectNumber + '|' + assetId + '|' + bomGroup + '|' + itemNumber",
    writableFields: ["partNumber", "description", "qty", "uom", "status"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
      { field: "assetId", referencesTable: "Assets", referencesDomain: "engineering", referencesKey: "assetUID", access: "read-only" },
      { field: "partNumber", referencesTable: "Part Master", referencesDomain: "engineering", referencesKey: "partNumber", access: "read-only" },
    ],
    description: "Bill of materials parts with composite tracking address.",
  },
  {
    tableName: "Part Master",
    ownerDomain: "engineering",
    primaryKeyFields: ["partNumber"],
    canonicalKeyFormula: "partNumber",
    writableFields: ["description", "category", "uom"],
    foreignKeyContracts: [],
    description: "Canonical part registry. Shared reference across all domains (read-only to others).",
  },

  // --- Client Support ---
  {
    tableName: "Customer RFQs",
    ownerDomain: "client-support",
    primaryKeyFields: ["rfqId"],
    writableFields: ["client", "date", "status", "itemCount"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Request for quotation from customers.",
  },
  {
    tableName: "Customer POs",
    ownerDomain: "client-support",
    primaryKeyFields: ["cpoId"],
    writableFields: ["value", "date", "status"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Customer purchase orders driving revenue flow.",
  },
  {
    tableName: "Vendor Parts",
    ownerDomain: "client-support",
    primaryKeyFields: ["sageVendorId", "vendorPartNumber"],
    canonicalKeyFormula: "sageVendorId + '|' + vendorPartNumber",
    writableFields: ["unitPrice", "leadTimeDays"],
    foreignKeyContracts: [
      { field: "sageVendorId", referencesTable: "Vendors", referencesDomain: "purchasing", referencesKey: "sageVendorId", access: "read-only" },
      { field: "partNumber", referencesTable: "Part Master", referencesDomain: "engineering", referencesKey: "partNumber", access: "read-only" },
    ],
    description: "Vendor-specific parts mapping to Part Master. Key = sageVendorId|vendorPartNumber.",
  },

  // --- Purchasing ---
  {
    tableName: "Vendors",
    ownerDomain: "purchasing",
    primaryKeyFields: ["sageVendorId"],
    canonicalKeyFormula: "sageVendorId",
    writableFields: ["name", "category", "rating", "country"],
    foreignKeyContracts: [],
    description: "Master vendor registry keyed by Sage ID.",
  },
  {
    tableName: "Purchase Orders",
    ownerDomain: "purchasing",
    primaryKeyFields: ["poId"],
    writableFields: ["value", "status", "lineCount", "source"],
    foreignKeyContracts: [
      { field: "sageVendorId", referencesTable: "Vendors", referencesDomain: "purchasing", referencesKey: "sageVendorId", access: "read-only" },
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Purchase orders created from Engineering packages or Client Support requests.",
  },

  // --- Warehouse ---
  {
    tableName: "Inventory",
    ownerDomain: "warehouse",
    primaryKeyFields: ["partNumber", "location"],
    writableFields: ["qty", "reserved", "available", "lastReceipt"],
    foreignKeyContracts: [
      { field: "partNumber", referencesTable: "Part Master", referencesDomain: "engineering", referencesKey: "partNumber", access: "read-only" },
    ],
    description: "Current stock by part number and warehouse location.",
  },
  {
    tableName: "Receipts",
    ownerDomain: "warehouse",
    primaryKeyFields: ["receiptId"],
    writableFields: ["date", "qtyReceived", "status"],
    foreignKeyContracts: [
      { field: "poId", referencesTable: "Purchase Orders", referencesDomain: "purchasing", referencesKey: "poId", access: "read-only" },
      { field: "partNumber", referencesTable: "Part Master", referencesDomain: "engineering", referencesKey: "partNumber", access: "read-only" },
    ],
    description: "Goods received against PO lines.",
  },
  {
    tableName: "Shipments",
    ownerDomain: "warehouse",
    primaryKeyFields: ["shipmentId"],
    writableFields: ["destination", "date", "status", "itemCount"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Outbound shipments to project sites.",
  },

  // --- Site Management ---
  {
    tableName: "Site Deliveries",
    ownerDomain: "site-management",
    primaryKeyFields: ["deliveryId"],
    writableFields: ["receivedDate", "status", "issues"],
    foreignKeyContracts: [
      { field: "shipmentId", referencesTable: "Shipments", referencesDomain: "warehouse", referencesKey: "shipmentId", access: "read-only" },
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Site-side receipt of warehouse shipments.",
  },
  {
    tableName: "Field Issues",
    ownerDomain: "site-management",
    primaryKeyFields: ["issueId"],
    writableFields: ["category", "description", "severity", "status"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Issues found during field installation.",
  },
  {
    tableName: "Install Readiness",
    ownerDomain: "site-management",
    primaryKeyFields: ["projectNumber", "area"],
    writableFields: ["readinessScore", "materialComplete", "drawingsApproved", "permitsReady"],
    foreignKeyContracts: [
      { field: "projectNumber", referencesTable: "Projects", referencesDomain: "project-management", referencesKey: "projectNumber", access: "read-only" },
    ],
    description: "Readiness checklist per project area.",
  },
];

// ===== HANDOFF CONTRACTS =====

export const handoffContracts: HandoffContract[] = [
  {
    id: "HC-01",
    name: "Engineering Procurement Package",
    fromDomain: "engineering",
    toDomain: "purchasing",
    headerTable: "Procurement Packages",
    lineTable: "Procurement Package Lines",
    triggerCondition: "BOM Group status = 'Released' for all items in scope",
    payloadFields: ["projectNumber", "assetUID", "bomGroup", "partNumber", "qty", "uom", "revision"],
  },
  {
    id: "HC-02",
    name: "Client Support Purchase Request",
    fromDomain: "client-support",
    toDomain: "purchasing",
    headerTable: "Commercial Purchase Requests",
    lineTable: "Purchase Request Lines",
    triggerCondition: "Customer PO accepted and line items confirmed",
    payloadFields: ["cpoId", "sageVendorId", "vendorPartNumber", "partNumber", "qty", "unitPrice"],
  },
  {
    id: "HC-03",
    name: "Purchasing PO Issuance",
    fromDomain: "purchasing",
    toDomain: "warehouse",
    headerTable: "Purchase Orders",
    lineTable: "PO Lines",
    triggerCondition: "PO status = 'Confirmed' and vendor acknowledgment received",
    payloadFields: ["poId", "sageVendorId", "partNumber", "qty", "expectedDate", "lineNumber"],
  },
  {
    id: "HC-04",
    name: "Warehouse Shipment",
    fromDomain: "warehouse",
    toDomain: "site-management",
    headerTable: "Shipments",
    lineTable: "Shipment Lines",
    triggerCondition: "All shipment items picked, packed, and QC-cleared",
    payloadFields: ["shipmentId", "projectNumber", "destination", "partNumber", "qty", "lotNumber"],
  },
];

// ===== BOM IMPORT SUBSYSTEM TYPES =====

export type ImportScope = "all" | "bom-group" | "asset";
export type DeltaAction = "added" | "updated" | "removed" | "unchanged";

export interface BOMImportBatch {
  batchId: string;
  projectNumber: string;
  scope: ImportScope;
  scopeFilter?: string; // assetUID or bomGroup name when scoped
  createdDate: string;
  status: "Staged" | "Processing" | "Complete" | "Failed";
  stagedCount: number;
  processedCount: number;
}

export interface BOMImportStagingRow {
  batchId: string;
  lineNumber: number;
  trackingAddress: string;
  partNumber: string;
  description: string;
  qty: number;
  uom: string;
  deltaAction: DeltaAction;
  validated: boolean;
  errorMessage?: string;
}

// ===== DOMAIN METADATA =====

export const domainLabels: Record<DomainKey, { label: string; abbr: string; colorClass: string }> = {
  "project-management": { label: "Project Management", abbr: "PM", colorClass: "text-data-blue" },
  "engineering": { label: "Engineering", abbr: "ENG", colorClass: "text-data-cyan" },
  "client-support": { label: "Client Support", abbr: "CS", colorClass: "text-data-amber" },
  "purchasing": { label: "Purchasing", abbr: "PUR", colorClass: "text-data-green" },
  "warehouse": { label: "Warehouse", abbr: "WH", colorClass: "text-data-purple" },
  "site-management": { label: "Site Management", abbr: "SITE", colorClass: "text-data-red" },
};

// ===== HELPER: Check if domain can write to table =====

export function canDomainWrite(domain: DomainKey, tableName: string): boolean {
  const contract = tableContracts.find(c => c.tableName === tableName);
  return contract?.ownerDomain === domain;
}

export function getTablesByDomain(domain: DomainKey): TableContract[] {
  return tableContracts.filter(c => c.ownerDomain === domain);
}

export function getForeignReferences(tableName: string): ForeignKeyContract[] {
  const contract = tableContracts.find(c => c.tableName === tableName);
  return contract?.foreignKeyContracts ?? [];
}
