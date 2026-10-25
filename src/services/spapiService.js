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
 * Simulador de sincronización oficial SP-API para pruebas antes de activar el Plan Profesional.
 * Si el usuario ya tiene productos en su catálogo, enriquece sus datos FBA (FNSKU, Tarifas FBA,
 * desglose de inventario FBA) usando la estructura exacta de respuesta de Amazon SP-API.
 * Si el catálogo está vacío, crea un SKU de demostración 100% FBA completo.
 */
export async function runSpApiSimulation(supabase) {
  const nowIso = new Date().toISOString();

  const { data: existingProducts, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: true });

  if (prodErr) throw prodErr;

  let targetProducts = existingProducts || [];

  // Si no hay productos aún, creamos un producto FBA de prueba realista
  if (targetProducts.length === 0) {
    const demoProduct = {
      sku_internal: 'FBA-PRO-001',
      sku_amazon: 'AMZ-FBA-PRO-001',
      asin_amazon: 'B09X7K2M9P',
      fnsku: 'X001FBA992',
      ean_code: '8437000000012',
      name: 'Soporte Magnético MagSafe Aluminio Aeroespacial (Demo SP-API)',
      brand: 'PrimeGear FBA',
      status: 'Active',
      cost_manufacturing: 5.80,
      cost_shipping: 0.70,
      target_price: 29.99,
      fba_fee: 4.15,
      referral_fee_pct: 15.0,
      buy_box_winner: true,
      spapi_last_sync: nowIso,
      notes: 'Producto sincronizado mediante simulador de estructura oficial Amazon SP-API'
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('products')
      .insert([demoProduct])
      .select();

    if (insertErr) throw insertErr;
    targetProducts = inserted || [];
  }

  const syncedSummaries = [];

  for (let i = 0; i < targetProducts.length; i++) {
    const p = targetProducts[i];
    const generatedFnsku = p.fnsku || `X001FBA${String(100 + i).slice(-3)}`;
    const generatedAsin = p.asin_amazon || `B09FBA0${100 + i}`;
    const generatedFbaFee = Number(p.fba_fee) > 0 ? Number(p.fba_fee) : 3.85;
    const generatedRefPct = Number(p.referral_fee_pct) > 0 ? Number(p.referral_fee_pct) : 15.0;

    //Actualizar metadatos FBA del producto
    await supabase
      .from('products')
      .update({
        fnsku: generatedFnsku,
        asin_amazon: generatedAsin,
        sku_amazon: p.sku_amazon || p.sku_internal,
        fba_fee: generatedFbaFee,
        referral_fee_pct: generatedRefPct,
        buy_box_winner: true,
        spapi_last_sync: nowIso
      })
      .eq('id', p.id);

    // Verificar estado actual de inventario para no sobrescribir stock real si ya tiene unidades
    const { data: invRows } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', p.id)
      .eq('warehouse_type', 'FBA')
      .limit(1);

    const currentInv = invRows && invRows[0];
    const hasExistingStock = currentInv && (currentInv.stock_current > 0 || currentInv.stock_in_transit > 0);

    // Payload oficial simulado de GET /fba/inventory/v1/summaries
    const mockSpApiSummary = {
      asin: generatedAsin,
      fnSku: generatedFnsku,
      sellerSku: p.sku_amazon || p.sku_internal,
      productName: p.name,
      condition: 'NewItem',
      lastUpdatedTime: nowIso,
      inventoryDetails: {
        fulfillableQuantity: hasExistingStock ? Math.max(0, currentInv.stock_current - currentInv.stock_reserved) : 140,
        inboundWorkingQuantity: 0,
        inboundShippedQuantity: hasExistingStock ? currentInv.stock_in_transit : 50,
        inboundReceivingQuantity: 0,
        reservedQuantity: {
          totalReservedQuantity: hasExistingStock ? currentInv.stock_reserved : 8,
          pendingCustomerOrderQuantity: hasExistingStock ? currentInv.stock_reserved : 6,
          pendingTransshipmentQuantity: 2,
          fcProcessingQuantity: 0
        },
        unfulfillableQuantity: {
          totalUnfulfillableQuantity: currentInv?.stock_unfulfillable || 2,
          customerDamagedQuantity: 1,
          warehouseDamagedQuantity: 1
        }
      }
    };

    const mapped = mapSpApiInventorySummaryToDb(mockSpApiSummary);

    if (currentInv) {
      await supabase
        .from('inventory')
        .update({
          ...mapped.inventoryPatch,
          stock_min: currentInv.stock_min > 0 ? currentInv.stock_min : 25
        })
        .eq('id', currentInv.id);
    } else {
      await supabase
        .from('inventory')
        .insert([{
          product_id: p.id,
          ...mapped.inventoryPatch,
          stock_min: 25
        }]);
    }

    syncedSummaries.push(mockSpApiSummary);
  }

  localStorage.setItem('amazon_spapi_last_sync', nowIso);

  return {
    syncedCount: syncedSummaries.length,
    timestamp: nowIso,
    samplePayload: syncedSummaries[0] || null
  };
}
