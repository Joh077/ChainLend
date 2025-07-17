import { ConnectButton } from "@rainbow-me/rainbowkit";

const Header = () => {
  return (
    <nav className="navbar">
      <div className="grow">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0">        
          </div>
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Header;