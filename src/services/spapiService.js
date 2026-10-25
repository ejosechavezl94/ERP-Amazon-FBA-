/**
 * Amazon Selling Partner API (SP-API) Service & Data Mappers
 * Operativa 100% Amazon FBA (Fulfillment by Amazon)
 *
 * Documentación de endpoints oficiales mapeados:
 * 1. FBA Inventory API v1: GET /fba/inventory/v1/summaries
 * 2. Product Fees API v0: POST /products/fees/v0/items/{Asin}/feesEstimate
 * 3. Orders API v0: GET /orders/v0/orders & GET /orders/v0/orders/{orderId}/orderItems
 * 4. Fulfillment Inbound API v2024-03-20: GET /inbound/fba/2024-03-20/shipments
 */

export const SPAPI_ENDPOINTS_SPEC = [
  {
    id: 'fba_inventory',
    name: 'FBA Inventory API v1',
    endpoint: 'GET /fba/inventory/v1/summaries',
    role: 'Inventario y Precios',
    targetTable: 'public.inventory',
    fieldsMapped: [
      'fnSku → products.fnsku',
      'asin → products.asin_amazon',
      'inventoryDetails.fulfillableQuantity → inventory.stock_current',
      'inventoryDetails.reservedQuantity.totalReservedQuantity → inventory.stock_reserved',
      'inventoryDetails.inboundWorkingQuantity + inboundShippedQuantity + inboundReceivingQuantity → inventory.stock_in_transit',
      'inventoryDetails.unfulfillableQuantity.totalUnfulfillableQuantity → inventory.stock_unfulfillable'
    ]
  },
  {
    id: 'product_fees',
    name: 'Product Fees API v0',
    endpoint: 'POST /products/fees/v0/items/{Asin}/feesEstimate',
    role: 'Inventario y Precios',
    targetTable: 'public.products',
    fieldsMapped: [
      'FeeDetailList[ReferralFee] → products.referral_fee_pct',
      'FeeDetailList[FBAFees] → products.fba_fee'
    ]
  },
  {
    id: 'orders_api',
    name: 'Orders API v0',
    endpoint: 'GET /orders/v0/orders (FulfillmentChannel=AFN)',
    role: 'Gestión de Pedidos',
    targetTable: 'public.sales',
    fieldsMapped: [
      'AmazonOrderId → sales.amazon_order_id',
      'PurchaseDate → sales.sale_date',
      'OrderItems.QuantityOrdered → sales.quantity',
      'MarketplaceId → sales.marketplace_id'
    ]
  },
  {
    id: 'inbound_shipments',
    name: 'Fulfillment Inbound API',
    endpoint: 'GET /inbound/fba/2024-03-20/shipments',
    role: 'Inventario y Precios',
    targetTable: 'public.purchase_orders',
    fieldsMapped: [
      'ShipmentId → purchase_orders.fba_shipment_id',
      'ShipmentStatus (WORKING, SHIPPED, RECEIVING, CLOSED) → purchase_orders.status'
    ]
  }
];

/**
 * Convierte un objeto oficial `InventorySummary` de Amazon SP-API
 * al formato exacto de las tablas `products` e `inventory` de Supabase.
 */
export function mapSpApiInventorySummaryToDb(summary) {
  const details = summary?.inventoryDetails || {};
  const reservedObj = details?.reservedQuantity || {};
  const unfulfillableObj = details?.unfulfillableQuantity || {};

  const fulfillable = Number(details.fulfillableQuantity ?? summary?.totalQuantity ?? 0);
  const reserved = Number(reservedObj.totalReservedQuantity ?? 0);
  const inboundWorking = Number(details.inboundWorkingQuantity ?? 0);
  const inboundShipped = Number(details.inboundShippedQuantity ?? 0);
  const inboundReceiving = Number(details.inboundReceivingQuantity ?? 0);
  const totalInbound = inboundWorking + inboundShipped + inboundReceiving;
  const unfulfillable = Number(unfulfillableObj.totalUnfulfillableQuantity ?? 0);

  return {
    productPatch: {
      sku_amazon: summary?.sellerSku || null,
      asin_amazon: summary?.asin || null,
      fnsku: summary?.fnSku || null,
      name: summary?.productName || undefined,
      spapi_last_sync: summary?.lastUpdatedTime || new Date().toISOString()
    },
    inventoryPatch: {
      warehouse_type: 'FBA',
      stock_current: fulfillable + reserved,
      stock_reserved: reserved,
      stock_in_transit: totalInbound,
      stock_unfulfillable: unfulfillable,
      inbound_working: inboundWorking,
      inbound_shipped: inboundShipped,
      inbound_receiving: inboundReceiving,
      last_updated: new Date().toISOString(),
      spapi_last_sync: summary?.lastUpdatedTime || new Date().toISOString()
    }
  };
}

/**
 * Calcula la rentabilidad neta FBA por unidad descontando:
 * - Coste de fabricación / adquisición (costManufacturing)
 * - Tarifa logística FBA por unidad (fbaFee)
 * - Comisión por referencia de Amazon (referralFeePct % sobre el PVP)
 */
export function calculateFbaUnitMetrics({ price = 0, cost = 0, fbaFee = 0, referralFeePct = 15 }) {
  const numPrice = Number(price) || 0;
  const numCost = Number(cost) || 0;
  const numFbaFee = Number(fbaFee) || 0;
  const numRefPct = Number(referralFeePct) ?? 15;

  const referralFeeEur = numPrice > 0 ? +(numPrice * (numRefPct / 100)).toFixed(2) : 0;
  const totalAmazonFees = +(numFbaFee + referralFeeEur).toFixed(2);
  const netProfit = +(numPrice - numCost - totalAmazonFees).toFixed(2);
  const netMarginPct = numPrice > 0 ? +((netProfit / numPrice) * 100).toFixed(1) : 0;
  const roiPct = numCost > 0 ? +((netProfit / numCost) * 100).toFixed(1) : 0;

  return {
    referralFeeEur,
    totalAmazonFees,
    netProfit,
    netMarginPct,
    roiPct
  };
}

/**
 * Simulador 100% en memoria de sincronización oficial SP-API.
 * NUNCA escribe, modifica ni borra datos en las tablas reales de Supabase.
 * Genera el payload oficial de `GET /fba/inventory/v1/summaries` y su mapeo
 * exclusivamente en memoria para fines de verificación técnica.
 */
export async function runSpApiSimulation() {
  const nowIso = new Date().toISOString();

  // Payload oficial simulado de GET /fba/inventory/v1/summaries (solo en memoria)
  const mockSpApiSummary = {
    asin: 'B09X7K2M9P',
    fnSku: 'X001FBA992',
    sellerSku: 'FBA-DEMO-MEM-001',
    productName: 'Producto de Prueba en Memoria (Simulación Sin Efectos Reales)',
    condition: 'NewItem',
    lastUpdatedTime: nowIso,
    inventoryDetails: {
      fulfillableQuantity: 140,
      inboundWorkingQuantity: 0,
      inboundShippedQuantity: 50,
      inboundReceivingQuantity: 0,
      reservedQuantity: {
        totalReservedQuantity: 8,
        pendingCustomerOrderQuantity: 6,
        pendingTransshipmentQuantity: 2,
        fcProcessingQuantity: 0
      },
      unfulfillableQuantity: {
        totalUnfulfillableQuantity: 2,
        customerDamagedQuantity: 1,
        warehouseDamagedQuantity: 1
      }
    }
  };

  const mapped = mapSpApiInventorySummaryToDb(mockSpApiSummary);

  return {
    syncedCount: 1,
    isInMemoryOnly: true,
    timestamp: nowIso,
    samplePayload: mockSpApiSummary,
    mappedDbPreview: mapped
  };
}
