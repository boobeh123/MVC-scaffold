exports.getIndex = async (req, res) => {
  res.render('index', { title: 'Home' });
};

exports.getDashboard = async (req, res) => {
  res.render('dashboard', { title: 'Dashboard' });
};
