class Storage {
  constructor() {
    this.items = [];
    this.categories = [];
  }

  async init() {
    try {
      const prodRes = await fetch('/api/items');
      this.items = await prodRes.json();
      
      const catRes = await fetch('/api/categories');
      this.categories = await catRes.json();

      this.sortItems(this.items);
      this.sortCategories(this.categories);
    } catch (e) {
      console.error("Failed to load data from API:", e);
    }
  }

  getItems() {
    return this.items;
  }

  getCategories() {
    return this.categories;
  }

  async saveCategorie(data) {
    if (data.id == 0) {
        data.id = new Date().getTime();
    }
    
    // Update local cache
    const existed = this.categories.find((c) => c.id == data.id);
    if (existed) {
        existed.title = data.title;
        existed.description = data.description;
        existed.updated = new Date().toISOString();
        data.id = existed.id;
    } else {
        data.updated = new Date().toISOString();
        this.categories.push(data);
    }

    this.sortCategories(this.categories);

    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`Failed to save category: ${response.status}`);
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
  }

  async saveItem(data) {
    const existed = this.items.find((p) => p.id == data.id);
    if (existed) {
        existed.itemCode = data.itemCode ?? existed.itemCode;
        existed.title = data.title;
        existed.size = data.size;
        existed.category = data.category;
        existed.quantity = data.quantity;
        existed.price = data.price;
        existed.monthlyDemand = data.monthlyDemand || 0;
        existed.updated = new Date().toISOString();
        data.id = existed.id;
    }

    try {
        const response = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`Failed to save item: ${response.status}`);
        }

        const result = await response.json();
        if (existed) {
          existed.itemCode = result.itemCode ?? existed.itemCode;
          existed.updated = new Date().toISOString();
        } else {
          data.id = result.id;
          data.itemCode = result.itemCode;
          data.updated = new Date().toISOString();
          this.items.push(data);
        }
        this.sortItems(this.items);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
  }

  sortItems(array) {
    array.sort((a, b) => {
      const codeA = Number(String(a.itemCode ?? a.id).match(/\d+/)?.[0] ?? 0);
      const codeB = Number(String(b.itemCode ?? b.id).match(/\d+/)?.[0] ?? 0);
      if (codeA !== codeB) return codeA - codeB;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }

  sortCategories(array) {
    array.sort((a, b) => (new Date(a.updated) < new Date(b.updated) ? 1 : -1));
  }

  async deleteItem(id) {
    this.items = this.items.filter(p => p.id != id);
    try {
        await fetch(`/api/items/${id}`, { method: 'DELETE' });
    } catch (e) { console.error(e); }
  }

  async deleteCategory(id) {
    this.categories = this.categories.filter(c => c.id != id);
    try {
        await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    } catch (e) { console.error(e); }
  }
}

export default new Storage();
