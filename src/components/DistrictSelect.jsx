import { useMemo, useState } from "react"
import { districts } from "../data/districts.js"

function DistrictSelect({ label = "District", selectedDistrict, onSelect, disabled = false }) {
  const [query, setQuery] = useState(selectedDistrict?.name || "")

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()

    if (!term) {
      return districts
    }

    return districts.filter((district) =>
      [district.name, district.bangla, district.division, ...district.keywords]
        .join(" ")
        .toLowerCase()
        .includes(term),
    )
  }, [query])

  const handleSelect = (district) => {
    setQuery(district.name)
    onSelect(district)
  }

  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search district"
        disabled={disabled}
      />
      <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
        {matches.slice(0, 8).map((district) => (
          <button
            key={district.name}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-emerald-50 ${
              selectedDistrict?.name === district.name ? "bg-emerald-50 text-emerald-800" : "text-slate-700"
            }`}
            type="button"
            onClick={() => handleSelect(district)}
            disabled={disabled}
          >
            <span>
              <span className="font-semibold">{district.name}</span>
              <span className="ml-2 text-slate-500">{district.bangla}</span>
            </span>
            <span className="text-xs text-slate-500">{district.division}</span>
          </button>
        ))}
        {matches.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-500">No district found.</p>
        )}
      </div>
    </label>
  )
}

export default DistrictSelect
