function Spinner({ className = "h-4 w-4" }) {
  return <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`} aria-hidden="true" />
}

export default Spinner
