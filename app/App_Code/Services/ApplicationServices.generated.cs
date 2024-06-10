using MyCompany.Handlers;
using MyCompany.Web;
using System.Web.Configuration;

namespace MyCompany.Services
{
    public class AppFrameworkConfig
    {

        public virtual void Initialize()
        {
            ApplicationServices.FrameworkAppName = "Demo";
            ApplicationServices.Version = "8.9.23.0";
            ApplicationServices.HostVersion = "1.2.5.0";
            var compilation = ((CompilationSection)(WebConfigurationManager.GetSection("system.web/compilation")));
            var releaseMode = !compilation.Debug;
            AquariumExtenderBase.EnableMinifiedScript = releaseMode;
            AquariumExtenderBase.EnableCombinedScript = releaseMode;
            ApplicationServices.EnableMinifiedCss = releaseMode;
            ApplicationServices.EnableCombinedCss = releaseMode;
            BlobFactoryConfig.Initialize();
        }
    }
}
