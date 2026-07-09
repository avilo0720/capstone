/**
 * Client-side table pagination helper.
 */
export default class Pagination {
  constructor({ pageSize = 10, container = null, onPageChange = null } = {}) {
    this.pageSize = pageSize;
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

  renderControls({ totalItems, totalPages, startIndex = 0, endIndex = 0 }) {
    if (!this.container) return;

    if (totalItems === 0) {
      this.container.innerHTML = "";
      this.container.classList.add("--hidden");
      return;
    }

    const start = startIndex || (this.currentPage - 1) * this.pageSize + 1;
    const end = endIndex || Math.min(this.currentPage * this.pageSize, totalItems);

    this.container.classList.remove("--hidden");
    const prevDisabled = this.currentPage <= 1 ? "disabled" : "";
    const nextDisabled = this.currentPage >= totalPages ? "disabled" : "";

    this.container.innerHTML = `
      <div class="table-pagination">
        <span class="table-pagination__info">
          Showing ${start}–${end} of ${totalItems}
        </span>
        <div class="table-pagination__controls">
          <button type="button" class="table-pagination__btn" data-page="prev" ${prevDisabled} aria-label="Previous page">Prev</button>
          <span class="table-pagination__page">Page ${this.currentPage} of ${totalPages}</span>
          <button type="button" class="table-pagination__btn" data-page="next" ${nextDisabled} aria-label="Next page">Next</button>
        </div>
      </div>`;

    this.container.querySelectorAll(".table-pagination__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const action = btn.dataset.page;
        if (action === "prev" && this.currentPage > 1) {
          this.currentPage -= 1;
        } else if (action === "next" && this.currentPage < totalPages) {
          this.currentPage += 1;
        }
        if (typeof this.onPageChange === "function") {
          this.onPageChange(this.currentPage);
        }
      });
    });
  }
}
