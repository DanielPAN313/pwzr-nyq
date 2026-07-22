const venuePaymentConfig = {
  kazimen: {
    venueId: "kazimen",
    venueName: "卡子门足球场",
    merchantId: "",
    merchantStatus: "reserved"
  }
};

function getVenuePaymentConfig(venueId) {
  return venuePaymentConfig[venueId] || venuePaymentConfig.kazimen;
}

module.exports = {
  getVenuePaymentConfig,
  venuePaymentConfig
};
