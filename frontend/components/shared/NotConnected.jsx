import { ExclamationTriangleIcon } from "@radix-ui/react-icons"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"


const NotConnected = () => {
  return (
    <Alert variant="default | destructive">
      <ExclamationTriangleIcon className=" text-red-900 h-4 w-4" />
      <AlertTitle className="text-red-900">WARNING !</AlertTitle>
      <AlertDescription>
      Please connect your Wallet to our Dapp.
      </AlertDescription>
    </Alert>
  )
}

export default NotConnected