import { useEffect, useMemo, useState } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { Edit2, PackagePlus, Search, Trash2, X } from "lucide-react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"

const initialForm = {
  name: "",
  banglaName: "",
  price: "",
  variants: "",
  tags: "",
  stock: "",
}

function Products() {
  const { currentUser } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formData, setFormData] = useState(initialForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser?.uid) {
      setProducts([])
      setLoading(false)
      return undefined
    }

    const productsRef = collection(db, "users", currentUser.uid, "products")
    const productsQuery = query(productsRef, orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        setProducts(
          snapshot.docs.map((productDoc) => ({
            id: productDoc.id,
            ...productDoc.data(),
          })),
        )
        setLoading(false)
      },
      (error) => {
        toast.error(error.message || "Could not load products.")
        setLoading(false)
      },
    )

    return unsubscribe
  }, [currentUser?.uid])

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return products
    }

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.banglaName,
        ...(product.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchableText.includes(term)
    })
  }, [products, searchTerm])

  const openAddModal = () => {
    setEditingProduct(null)
    setFormData(initialForm)
    setIsModalOpen(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name || "",
      banglaName: product.banglaName || "",
      price: String(product.price ?? ""),
      variants: (product.variants || []).join(", "),
      tags: (product.tags || []).join(", "),
      stock: String(product.stock ?? ""),
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (saving) {
      return
    }

    setIsModalOpen(false)
    setEditingProduct(null)
    setFormData(initialForm)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()

    const name = formData.name.trim()
    const banglaName = formData.banglaName.trim()
    const price = Number(formData.price)
    const stock = Number(formData.stock)

    if (!name || !banglaName) {
      toast.error("Enter both English and Bangla product names.")
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid product price.")
      return
    }

    if (!Number.isInteger(stock) || stock < 0) {
      toast.error("Enter a valid stock quantity.")
      return
    }

    const payload = {
      name,
      banglaName,
      price,
      variants: splitCommaList(formData.variants),
      tags: splitCommaList(formData.tags),
      stock,
    }

    try {
      setSaving(true)

      if (editingProduct) {
        const productRef = doc(
          db,
          "users",
          currentUser.uid,
          "products",
          editingProduct.id,
        )
        await updateDoc(productRef, payload)
        toast.success("Product updated.")
      } else {
        const productsRef = collection(db, "users", currentUser.uid, "products")
        await addDoc(productsRef, {
          ...payload,
          createdAt: serverTimestamp(),
        })
        toast.success("Product added.")
      }

      setIsModalOpen(false)
      setEditingProduct(null)
      setFormData(initialForm)
    } catch (error) {
      toast.error(error.message || "Could not save product.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (product) => {
    const confirmed = window.confirm(
      `Delete ${product.name}? This cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "products", product.id))
      toast.success("Product deleted.")
    } catch (error) {
      toast.error(error.message || "Could not delete product.")
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">
            Catalog
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
            Products
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage the product names, aliases, variants, stock, and prices SellerBot will use for chat parsing and invoices.
          </p>
        </div>

        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765]"
          type="button"
          onClick={openAddModal}
        >
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
          Add Product
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20">
        <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by product name or tags"
        />
      </div>

      {loading ? (
        <div className="flex min-h-52 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1D9E75]" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-slate-950">
            No products yet. Add your first product!
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Your catalog will appear here as soon as you save an item.
          </p>
          <button
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765]"
            type="button"
            onClick={openAddModal}
          >
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Add Product
          </button>
        </div>
      )}

      {isModalOpen && (
        <ProductModal
          formData={formData}
          isEditing={Boolean(editingProduct)}
          saving={saving}
          onChange={handleChange}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </section>
  )
}

function ProductCard({ product, onEdit, onDelete }) {
  return (
    <article className="flex min-h-64 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-xl font-semibold text-slate-950">
              {product.name}
            </h3>
            <p className="mt-1 break-words text-sm font-medium text-[#1D9E75]">
              {product.banglaName}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">
            {"\u09f3"}{product.price ?? 0}
          </span>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <p className="font-medium text-slate-700">Variants</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(product.variants || []).length > 0 ? (
                product.variants.map((variant) => (
                  <span
                    key={variant}
                    className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                  >
                    {variant}
                  </span>
                ))
              ) : (
                <span className="text-slate-500">No variants</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
            <span className="font-medium text-slate-700">Stock</span>
            <span className="font-semibold text-slate-950">{product.stock ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          type="button"
          onClick={() => onEdit(product)}
        >
          <Edit2 className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          type="button"
          onClick={() => onDelete(product)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    </article>
  )
}

function ProductModal({ formData, isEditing, saving, onChange, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">
              {isEditing ? "Edit item" : "New item"}
            </p>
            <h3 className="text-xl font-semibold text-slate-950">
              {isEditing ? "Edit Product" : "Add Product"}
            </h3>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close product modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-5 px-5 py-5" onSubmit={onSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Product Name (English)"
              name="name"
              value={formData.name}
              onChange={onChange}
              placeholder="Shirt"
              disabled={saving}
            />
            <Field
              label="Product Name (Bangla)"
              name="banglaName"
              value={formData.banglaName}
              onChange={onChange}
              placeholder={"\u09b6\u09be\u09b0\u09cd\u099f"}
              disabled={saving}
            />
            <Field
              label={<>Price ({"\u09f3"})</>}
              name="price"
              value={formData.price}
              onChange={onChange}
              placeholder="500"
              type="number"
              min="0"
              disabled={saving}
            />
            <Field
              label="Stock quantity"
              name="stock"
              value={formData.stock}
              onChange={onChange}
              placeholder="100"
              type="number"
              min="0"
              step="1"
              disabled={saving}
            />
          </div>

          <Field
            label="Variants (comma separated)"
            name="variants"
            value={formData.variants}
            onChange={onChange}
            placeholder="Red, Blue, Green"
            disabled={saving}
          />
          <Field
            label="Tags (comma separated)"
            name="tags"
            value={formData.tags}
            onChange={onChange}
            placeholder={"shart, shirt, \u09b6\u09be\u09b0\u09cd\u099f, kamiz"}
            disabled={saving}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765] disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Field({ label, name, value, onChange, type = "text", ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20"
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        {...props}
      />
    </label>
  )
}

function splitCommaList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default Products
