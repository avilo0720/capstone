/**
 * Client-side table pagination helper.
 */
export default class Pagination {
  constructor({
    pageSize = 10,
    pageSizeOptions = [5, 10, 25, 50, 100],
    container = null,
    onPageChange = null,
  } = {}) {
    this.pageSizeOptions = pageSizeOptions;
    this.pageSize = pageSizeOptions.includes(pageSize)
      ? pageSize
      : pageSizeOptions[0] || 10;
    this.currentPage = 1;
    this.container = container;
    this.onPageChange = onPageChange;
  }

  setContainer(container) {
    this.container = container;
  }

  reset() {
    this.currentPage = 1;
  }

  setPageSize(size) {
    const next = Number.parseInt(size, 10);
    if (Number.isNaN(next) || next <= 0 || next === this.pageSize) return;
    this.pageSize = next;
    this.currentPage = 1;
    if (typeof this.onPageChange === "function") {
      this.onPageChange(this.currentPage);
    }
  }

  getSlice(items) {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    return {
      items: items.slice(start, start + this.pageSize),
      totalItems,
      totalPages,
      startIndex: totalItems === 0 ? 0 : start + 1,
      endIndex: Math.min(start + this.pageSize, totalItems),
    };
  }

  goToPage(page, totalPages) {
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === this.currentPage) return;
    this.currentPage = next;
    if (typeof this.onPageChange === "function") {
      this.onPageChange(this.currentPage);
    }
  }

  renderControls({ totalItems, totalPages, startIndex = 0, endIndex = 0 }) {
    if (!this.container) return;

    if (totalItems === 0) {
      this.container.innerHTML = "";
      this.container.classList.add("--hidden");
      return;
    }

    const start = startIndex || (this.currentPage - 1) * this.pageSize + 1;
    const end = endIndex || Math.min(this.currentPage * this.pageSize, totalItems);

    const sizeOptions = this.pageSizeOptions
      .map(
        (size) =>
          `<option value="${size}" ${size === this.pageSize ? "selected" : ""}>${size}</option>`
      )
      .join("");

    this.container.classList.remove("--hidden");
    const prevDisabled = this.currentPage <= 1 ? "disabled" : "";
    const nextDisabled = this.currentPage >= totalPages ? "disabled" : "";

    this.container.innerHTML = `
      <div class="table-pagination">
        <div class="table-pagination__meta">
          <span class="table-pagination__info">
            Showing ${start}–${end} of ${totalItems}
          </span>
          <label class="table-pagination__size">
            <span class="table-pagination__size-label">Show</span>
            <select class="table-pagination__size-select" aria-label="Items per page">
              ${sizeOptions}
            </select>
          </label>
        </div>
        <div class="table-pagination__controls">
          <button type="button" class="table-pagination__btn" data-page="prev" ${prevDisabled} aria-label="Previous page">Prev</button>
          <label class="table-pagination__page">
            <span class="table-pagination__page-label">Page</span>
            <input
              type="number"
              class="table-pagination__page-input"
              min="1"
              max="${totalPages}"
              value="${this.currentPage}"
              inputmode="numeric"
              aria-label="Page number"
            />
            <span class="table-pagination__page-total">/ ${totalPages}</span>
          </label>
          <button type="button" class="table-pagination__btn" data-page="next" ${nextDisabled} aria-label="Next page">Next</button>
        </div>
      </div>`;

    this.container.querySelectorAll(".table-pagination__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const action = btn.dataset.page;
        if (action === "prev") {
          this.goToPage(this.currentPage - 1, totalPages);
        } else if (action === "next") {
          this.goToPage(this.currentPage + 1, totalPages);
        }
      });
    });

    const pageInput = this.container.querySelector(".table-pagination__page-input");
    if (pageInput) {
      const submitPage = () => {
        const pageNum = Number.parseInt(pageInput.value, 10);
        if (Number.isNaN(pageNum)) {
          pageInput.value = String(this.currentPage);
          return;
        }
        this.goToPage(pageNum, totalPages);
        pageInput.value = String(this.currentPage);
      };

      pageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitPage();
          pageInput.blur();
        }
      });

      pageInput.addEventListener("blur", submitPage);
    }

    const sizeSelect = this.container.querySelector(".table-pagination__size-select");
    if (sizeSelect) {
      sizeSelect.addEventListener("change", () => {
        this.setPageSize(sizeSelect.value);
      });
    }
  }
}
