import { doc, updateDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "../firebase/config"

export async function uploadShopLogo(uid, file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file")
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo must be less than 2MB")
  }

  const storageRef = ref(storage, `logos/${uid}/shop-logo`)
  await uploadBytes(storageRef, file)
  const downloadURL = await getDownloadURL(storageRef)

  await updateDoc(doc(db, "users", uid, "settings", "shop"), {
    logoURL: downloadURL,
    updatedAt: new Date(),
  })

  return downloadURL
}
