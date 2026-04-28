
include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-modemstatus
LUCI_TITLE:=LuCI Modem Signal Strength
LUCI_DESCRIPTION:=Modem signal strength and carrier aggregation status for Quectel 5G modems
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+sms-tool
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
