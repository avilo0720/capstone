@if(($inventories ?? collect())->isNotEmpty())
  <label class="sideBar__inventory-switch">
    <span class="sideBar__inventory-switch-label">Inventory</span>
    <select class="inventorySwitch" aria-label="Select inventory">
      @foreach($inventories as $inventory)
        <option value="{{ $inventory->slug }}" @selected(($currentInventory->slug ?? '') === $inventory->slug)>
          {{ $inventory->name }}
        </option>
      @endforeach
    </select>
  </label>
@endif
